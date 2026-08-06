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

// Material.category = the INSTALLATION SYSTEM (GKW / CV / KW-WW-CIRC /
// RIOOL-HWA), a different axis from `class`. It exists so a technician can
// narrow the werkbon line picker to the system being worked on — so the filter
// must narrow, and must never hide the uncategorised materials by default.
describe("material category (installation system)", () => {
  const CAT_TAG = `${TAG} cat`;
  let cvId: string;
  let rioolId: string;
  let uncategorisedId: string;

  beforeAll(async () => {
    const create = (name: string, category?: string) =>
      request(app)
        .post("/api/materials")
        .set(auth(adminToken))
        .send({
          name,
          class: "insulation",
          sizeUnit: "flat",
          ...(category ? { category } : {}),
        });
    cvId = (await create(`${CAT_TAG} CV pipe`, "cv")).body.id;
    rioolId = (await create(`${CAT_TAG} Drain pipe`, "riool_hwa")).body.id;
    uncategorisedId = (await create(`${CAT_TAG} No system`)).body.id;
  });

  const groupIds = (body: { materials: { id: string }[] }[]) =>
    body.flatMap((g) => g.materials.map((m) => m.id));

  it("stores the category on create and returns it in the DTO", async () => {
    const res = await request(app).get(`/api/materials/${cvId}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.category).toBe("cv");
  });

  it("omits the category for an uncategorised material", async () => {
    const res = await request(app).get(`/api/materials/${uncategorisedId}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.category).toBeUndefined();
  });

  it("?category= narrows the grouped catalog to that system", async () => {
    const res = await request(app).get("/api/materials?category=cv").set(auth(adminToken));
    expect(res.status).toBe(200);
    const ids = groupIds(res.body);
    expect(ids).toContain(cvId);
    expect(ids).not.toContain(rioolId);
    expect(ids).not.toContain(uncategorisedId);
  });

  it("no ?category= returns everything, uncategorised included", async () => {
    const res = await request(app).get("/api/materials").set(auth(adminToken));
    expect(res.status).toBe(200);
    const ids = groupIds(res.body);
    expect(ids).toEqual(expect.arrayContaining([cvId, rioolId, uncategorisedId]));
  });

  it("an empty ?category= means 'all', not 'none' (never hides everything)", async () => {
    const res = await request(app).get("/api/materials?category=").set(auth(adminToken));
    expect(res.status).toBe(200);
    const ids = groupIds(res.body);
    expect(ids).toEqual(expect.arrayContaining([cvId, rioolId, uncategorisedId]));
  });

  it("rejects an unknown category (400)", async () => {
    const res = await request(app).get("/api/materials?category=nonsense").set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it("?category= also filters the flat variant search", async () => {
    await request(app)
      .post(`/api/materials/${cvId}/variants`)
      .set(auth(adminToken))
      .send({ size: "flat", component: "area", unit: "m2", unitPrice: 3 });
    await request(app)
      .post(`/api/materials/${rioolId}/variants`)
      .set(auth(adminToken))
      .send({ size: "flat", component: "area", unit: "m2", unitPrice: 4 });

    // Walk every page: the seeded catalog has ~1500 variants, so the CV rows
    // created here (appended last by ordinal) are well past the first page.
    const idsFor = async (category: string) => {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const res = await request(app)
          .get(
            `/api/materials/variants?category=${category}&limit=100` +
              (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""),
          )
          .set(auth(adminToken));
        expect(res.status).toBe(200);
        for (const i of res.body.items as { materialId: string }[]) seen.push(i.materialId);
        cursor = res.body.nextCursor ?? undefined;
      } while (cursor);
      return seen;
    };

    const cvIds = await idsFor("cv");
    expect(cvIds).toContain(cvId);
    expect(cvIds).not.toContain(rioolId);

    const rioolIds = await idsFor("riool_hwa");
    expect(rioolIds).toContain(rioolId);
    expect(rioolIds).not.toContain(cvId);
  });

  it("admin can change and clear the category", async () => {
    const changed = await request(app)
      .patch(`/api/materials/${uncategorisedId}`)
      .set(auth(adminToken))
      .send({ category: "gkw" });
    expect(changed.status).toBe(200);
    expect(changed.body.category).toBe("gkw");

    // null is a real value here: it puts the material back to "no system".
    const cleared = await request(app)
      .patch(`/api/materials/${uncategorisedId}`)
      .set(auth(adminToken))
      .send({ category: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.category).toBeUndefined();
  });

  it("rejects an unknown category on create (400)", async () => {
    const res = await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({ name: `${CAT_TAG} bad`, class: "insulation", sizeUnit: "flat", category: "hvac" });
    expect(res.status).toBe(400);
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

  it("serves the installation-system options with their trade-code labels", async () => {
    const res = await request(app).get("/api/materials/meta").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { value: string }) => c.value)).toEqual([
      "gkw",
      "cv",
      "kw_ww_circ",
      "riool_hwa",
    ]);
    const kwc = res.body.categories.find((c: { value: string }) => c.value === "kw_ww_circ");
    expect(kwc.nl).toBe("KW/WW/CIRC");
    expect(kwc.en).toBe("KW/WW/CIRC");
  });

  it("does not swallow /variants under /:id (literal routes win)", async () => {
    // A GET on /variants must hit the flat search, not GET /:id with id=variants.
    const res = await request(app).get("/api/materials/variants").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
