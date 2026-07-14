import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Materials + variants are USER-MANAGED: create / edit / delete via the app.
// The seed only bootstraps; a hand-created material has no link to any supplier
// PDF. These tests cover the full CRUD, the unique-variant constraint, the
// in-use delete guard, and admin-only write gating.

const TAG = "matcrud-test";
let orgId: string;
let adminToken: string;
let technicianToken: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;
  await prisma.material.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  const technician = await prisma.user.create({
    data: { orgId, email: `${TAG}-t@opero.test`, passwordHash: pw, name: "T", role: "technician", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
  technicianToken = signAccessToken({ sub: technician.id, role: "technician", orgId });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.material.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("material CRUD", () => {
  let materialId: string;

  it("admin creates a material (key + ordinal generated server-side)", async () => {
    const res = await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({
        name: `${TAG} Brand New Material`,
        class: "insulation",
        supplier: "Acme",
        sizeUnit: "pipe_od_mm",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(`${TAG} Brand New Material`);
    expect(res.body.key).toMatch(/^insulation_/); // auto-generated slug
    expect(res.body.variants).toEqual([]);
    materialId = res.body.id;
  });

  it("technician cannot create a material (403)", async () => {
    const res = await request(app)
      .post("/api/materials")
      .set(auth(technicianToken))
      .send({ name: `${TAG} Nope`, class: "insulation", sizeUnit: "flat" });
    expect(res.status).toBe(403);
  });

  it("admin edits the material", async () => {
    const res = await request(app)
      .patch(`/api/materials/${materialId}`)
      .set(auth(adminToken))
      .send({ name: `${TAG} Renamed`, supplier: "NewSupplier", note: "handy" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`${TAG} Renamed`);
    expect(res.body.supplier).toBe("NewSupplier");
    expect(res.body.note).toBe("handy");
  });

  it("a second material with the same name still gets a unique key", async () => {
    const res = await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({ name: `${TAG} Renamed`, class: "insulation", sizeUnit: "flat" });
    expect(res.status).toBe(201);
    expect(res.body.key).not.toBe("");
    // Clean up this throwaway.
    await request(app).delete(`/api/materials/${res.body.id}`).set(auth(adminToken));
  });

  describe("variant CRUD under a material", () => {
    let variantId: string;

    it("admin adds a variant", async () => {
      const res = await request(app)
        .post(`/api/materials/${materialId}/variants`)
        .set(auth(adminToken))
        .send({ size: "22", component: "elbow", unit: "piece", unitPrice: 12.5, costPrice: 8 });
      expect(res.status).toBe(201);
      expect(res.body.unitPrice).toBe(12.5);
      expect(res.body.costPrice).toBe(8);
      variantId = res.body.id;
    });

    it("a duplicate size+component+thickness is rejected (409)", async () => {
      const res = await request(app)
        .post(`/api/materials/${materialId}/variants`)
        .set(auth(adminToken))
        .send({ size: "22", component: "elbow", unit: "piece", unitPrice: 99 });
      expect(res.status).toBe(409);
    });

    it("admin edits the variant (price + size)", async () => {
      const res = await request(app)
        .patch(`/api/materials/variants/${variantId}`)
        .set(auth(adminToken))
        .send({ unitPrice: 15, size: "28" });
      expect(res.status).toBe(200);
      expect(res.body.unitPrice).toBe(15);
      expect(res.body.size).toBe("28");
    });

    it("cost-only edit still works (back-compat)", async () => {
      const res = await request(app)
        .patch(`/api/materials/variants/${variantId}`)
        .set(auth(adminToken))
        .send({ costPrice: 9 });
      expect(res.status).toBe(200);
      expect(res.body.costPrice).toBe(9);
    });

    it("technician cannot edit a variant (403)", async () => {
      const res = await request(app)
        .patch(`/api/materials/variants/${variantId}`)
        .set(auth(technicianToken))
        .send({ unitPrice: 1 });
      expect(res.status).toBe(403);
    });

    it("admin deletes an unused variant (204)", async () => {
      const res = await request(app)
        .delete(`/api/materials/variants/${variantId}`)
        .set(auth(adminToken));
      expect(res.status).toBe(204);
      const gone = await prisma.materialVariant.findUnique({ where: { id: variantId } });
      expect(gone).toBeNull();
    });
  });

  describe("delete guard: variant used on a werkbon line", () => {
    let usedVariantId: string;
    let usedMaterialId: string;
    let taskMaterialId: string;

    beforeAll(async () => {
      const created = await request(app)
        .post("/api/materials")
        .set(auth(adminToken))
        .send({ name: `${TAG} Used`, class: "insulation", sizeUnit: "flat" });
      usedMaterialId = created.body.id;
      const v = await request(app)
        .post(`/api/materials/${usedMaterialId}/variants`)
        .set(auth(adminToken))
        .send({ size: "flat", component: "area", unit: "m2", unitPrice: 5 });
      usedVariantId = v.body.id;

      // Attach it to a work-order task line so it counts as "in use".
      const project = await prisma.project.findFirstOrThrow({ where: { orgId, deletedAt: null } });
      const wo = await prisma.workOrder.create({ data: { projectId: project.id, title: `${TAG} WO`, ordinal: 900 } });
      const task = await prisma.workOrderTask.create({ data: { workOrderId: wo.id, description: "z", ordinal: 0 } });
      const tm = await prisma.taskMaterial.create({
        data: { taskId: task.id, name: "used line", quantity: 1, unit: "m2", unitPrice: 5, variantId: usedVariantId, ordinal: 0 },
      });
      taskMaterialId = tm.id;
    });

    it("blocks deleting a variant that's in use (409)", async () => {
      const res = await request(app)
        .delete(`/api/materials/variants/${usedVariantId}`)
        .set(auth(adminToken));
      expect(res.status).toBe(409);
    });

    it("blocks deleting the parent material too (409)", async () => {
      const res = await request(app)
        .delete(`/api/materials/${usedMaterialId}`)
        .set(auth(adminToken));
      expect(res.status).toBe(409);
    });

    it("?force=true deletes it and the task line keeps its snapshot", async () => {
      const res = await request(app)
        .delete(`/api/materials/variants/${usedVariantId}?force=true`)
        .set(auth(adminToken));
      expect(res.status).toBe(204);
      // The line survives with its snapshotted name/price; variantId nulled.
      const line = await prisma.taskMaterial.findUnique({ where: { id: taskMaterialId } });
      expect(line).not.toBeNull();
      expect(line!.name).toBe("used line");
      expect(line!.unitPrice).toBe(5);
      expect(line!.variantId).toBeNull();
    });
  });

  it("admin deletes the material (204)", async () => {
    const res = await request(app)
      .delete(`/api/materials/${materialId}`)
      .set(auth(adminToken));
    expect(res.status).toBe(204);
  });
});

describe("GET /materials/meta", () => {
  it("returns enum option lists with nl+en labels", async () => {
    const res = await request(app).get("/api/materials/meta").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.classes.length).toBe(4);
    expect(res.body.components.length).toBeGreaterThan(5);
    expect(res.body.sizeUnits.length).toBe(4);
    const insulation = res.body.classes.find((c: { value: string }) => c.value === "insulation");
    expect(insulation.nl).toBe("Isolatie");
    expect(insulation.en).toBe("Insulation");
  });

  it("does not swallow /variants under /:id (literal routes win)", async () => {
    // A GET on /variants must hit the flat search, not GET /:id with id=variants.
    const res = await request(app).get("/api/materials/variants").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
