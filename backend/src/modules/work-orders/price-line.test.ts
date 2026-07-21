import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// From-catalog material lines (server-side price resolution) + the
// customer-facing quote (offerte) PDF export.

const TAG = "priceline-test";
let orgId: string;
let otherOrgId: string;
let adminToken: string;
let technicianToken: string;
let projectId: string;
let employeeId: string;
let workOrderId: string;
let taskId: string;
let ownVariantId: string;
let ownVariantId2: string;
let otherOrgVariantId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function createCatalogVariant(org: string, suffix: string): Promise<string> {
  const material = await prisma.material.create({
    data: {
      orgId: org,
      key: `${TAG}_material_${suffix}`,
      name: `${TAG} AF/2`,
      class: "insulation",
      supplier: `${TAG}-supplier`,
      pipeMaterial: "steel",
      thicknessMm: 13,
      finish: "none",
      sizeUnit: "pipe_od_mm",
      priceSource: `${TAG}-source`,
      ordinal: 999,
      variants: {
        create: [
          // Selling 28.25, cost 20.00 → per-line margin 8.25/unit.
          { size: "60", component: "elbow", unit: "piece", unitPrice: 28.25, costPrice: 20, ordinal: 0 },
        ],
      },
    },
    include: { variants: true },
  });
  return material.variants[0].id;
}

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;
  const otherOrg = await prisma.organization.create({ data: { name: `${TAG}-other-org` } });
  otherOrgId = otherOrg.id;

  await prisma.material.deleteMany({ where: { key: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  // Technician linked to an employee that's assigned (installer) on the
  // project, so requireWritableWorkOrder lets them write.
  const employee = await prisma.employee.create({
    data: { orgId, name: `${TAG}-tech`, phone: "0", roles: ["Technician"], status: "active" },
  });
  employeeId = employee.id;
  const technician = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-t@opero.test`,
      passwordHash: pw,
      name: "T",
      role: "technician",
      status: "active",
      employeeId,
    },
  });
  technicianToken = signAccessToken({ sub: technician.id, role: "technician", orgId });

  const project = await prisma.project.findFirstOrThrow({ where: { orgId, deletedAt: null } });
  projectId = project.id;
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { connect: { id: employeeId } } },
  });

  // Throwaway work order + one task.
  const wo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId, title: `${TAG} WO` });
  workOrderId = wo.body.id;
  const withTask = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({});
  taskId = withTask.body.tasks[0].id;

  ownVariantId = await createCatalogVariant(orgId, "own");
  otherOrgVariantId = await createCatalogVariant(otherOrgId, "other");

  // A second variant on the SAME org material (different size + prices) so we can
  // test switching a line's variant re-resolves name/price/cost server-side.
  const ownVar = await prisma.materialVariant.findUniqueOrThrow({
    where: { id: ownVariantId },
  });
  const v2 = await prisma.materialVariant.create({
    data: {
      materialId: ownVar.materialId,
      size: "88",
      component: "elbow",
      unit: "piece",
      unitPrice: 40,
      costPrice: 25,
      ordinal: 1,
    },
  });
  ownVariantId2 = v2.id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.material.deleteMany({ where: { key: { startsWith: TAG } } });
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { disconnect: { id: employeeId } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

type MaterialDto = {
  id: string;
  name: string;
  unit: string;
  diameter?: number;
  unitPrice?: number;
  costPrice?: number;
  margin?: number;
  marginPct?: number;
  variantId?: string;
  quantity: number;
};
const materialsOf = (body: {
  tasks: { id: string; materials: MaterialDto[] }[];
}): MaterialDto[] => body.tasks.find((t) => t.id === taskId)?.materials ?? [];

describe("materials from catalog", () => {
  it("admin adds a line — name/unit/price/diameter resolved server-side", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: ownVariantId, quantity: 3 });
    expect(res.status).toBe(201);
    const mat = materialsOf(res.body).find((m) => m.variantId === ownVariantId);
    expect(mat).toBeDefined();
    expect(mat!.name).toBe(`Ø 60 ${TAG} AF/2 Bocht`);
    expect(mat!.unit).toBe("stuk");
    expect(mat!.quantity).toBe(3);
    expect(mat!.diameter).toBe(60);
    expect(mat!.unitPrice).toBe(28.25);
  });

  it("technician adds a line — price still set server-side, but stripped in their response", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-catalog`)
      .set(auth(technicianToken))
      .send({ variantId: ownVariantId, quantity: 2 });
    expect(res.status).toBe(201);
    const techView = materialsOf(res.body).filter((m) => m.variantId === ownVariantId);
    // Technician response: line present, price stripped.
    expect(techView.length).toBeGreaterThanOrEqual(2);
    for (const m of techView) expect(m.unitPrice).toBeUndefined();

    // Admin view of the same work order: the technician-added line HAS a price.
    const adminView = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken));
    const line = materialsOf(adminView.body).find(
      (m) => m.variantId === ownVariantId && m.quantity === 2,
    );
    expect(line?.unitPrice).toBe(28.25);
  });

  it("rejects a variant from another org (404)", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: otherOrgVariantId, quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe("cost / margin visibility (3-way on the billable line)", () => {
  // The admin already added a qty-3 line of ownVariantId in the first test.
  it("admin sees selling price AND cost + margin", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken));
    const line = materialsOf(res.body).find(
      (m) => m.variantId === ownVariantId && m.quantity === 3,
    );
    expect(line).toBeDefined();
    expect(line!.unitPrice).toBe(28.25); // sell
    expect(line!.costPrice).toBe(20); // cost snapshot
    expect(line!.margin).toBeCloseTo((28.25 - 20) * 3, 5); // (sell−cost)×qty
    expect(line!.marginPct).toBeCloseTo(((28.25 - 20) / 28.25) * 100, 3);
  });

  // Clients reach werkbon prices through the role-aware DTO (their route access
  // is customer-scoped elsewhere). Assert the DTO guarantee directly: a client
  // gets the selling price but NEVER cost/margin. This is the exact contract the
  // work-order and project DTOs must uphold for the client (opdrachtgever) view.
  it("client DTO exposes the selling price but NEVER cost or margin", async () => {
    const { workOrderDto } = await import("./dto.js");
    const { workOrderInclude } = await import("./dto.js");
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      include: workOrderInclude,
    });
    const dto = await workOrderDto(wb as never, "client");
    const line = dto.tasks
      .flatMap((t) => t.materials)
      .find((m) => m.variantId === ownVariantId && m.quantity === 3) as
      | MaterialDto
      | undefined;
    expect(line).toBeDefined();
    expect(line!.unitPrice).toBe(28.25); // sell IS visible
    expect(line!.costPrice).toBeUndefined(); // cost NEVER
    expect(line!.margin).toBeUndefined();
    expect(line!.marginPct).toBeUndefined();
  });

  it("technician sees no price at all (and therefore no margin)", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(technicianToken));
    for (const m of materialsOf(res.body)) {
      expect(m.unitPrice).toBeUndefined();
      expect(m.costPrice).toBeUndefined();
      expect(m.margin).toBeUndefined();
    }
  });

  it("PATCH /materials/variants/:id sets cost (admin) and is forbidden for others", async () => {
    // Technician cannot write cost.
    const techPatch = await request(app)
      .patch(`/api/materials/variants/${ownVariantId}`)
      .set(auth(technicianToken))
      .send({ costPrice: 15 });
    expect(techPatch.status).toBe(403);

    // Admin updates cost; response carries the new cost.
    const adminPatch = await request(app)
      .patch(`/api/materials/variants/${ownVariantId}`)
      .set(auth(adminToken))
      .send({ costPrice: 22.5 });
    expect(adminPatch.status).toBe(200);
    expect(adminPatch.body.costPrice).toBe(22.5);

    // Existing work-order lines keep their SNAPSHOT (20), not the new catalog cost.
    const woView = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken));
    const line = materialsOf(woView.body).find(
      (m) => m.variantId === ownVariantId && m.quantity === 3,
    );
    expect(line!.costPrice).toBe(20);
  });
});

describe("werkbon-level monteur assignment (multiple)", () => {
  it("admin assigns monteur(s) on the werkbon; DTO returns them", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ assigneeIds: [employeeId] });
    expect(res.status).toBe(200);
    expect(res.body.assignees).toEqual([{ id: employeeId, name: `${TAG}-tech` }]);
  });

  it("assigning an employee from another org is rejected (400)", async () => {
    const otherEmp = await prisma.employee.create({
      data: { orgId: otherOrgId, name: `${TAG}-other-emp`, phone: "0", roles: ["Technician"], status: "active" },
    });
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ assigneeIds: [otherEmp.id] });
    expect(res.status).toBe(400);
  });

  it("clearing the crew (empty array) works", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ assigneeIds: [] });
    expect(res.status).toBe(200);
    expect(res.body.assignees).toEqual([]);
  });
});

describe("invoice-line editing (variant switch + derived zone status)", () => {
  it("switching a line's variant re-resolves name / price / cost server-side", async () => {
    // Add a fresh line (qty 1) on ownVariantId, then repoint it to ownVariantId2.
    const added = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: ownVariantId, quantity: 1 });
    const created = materialsOf(added.body).find(
      (m) => m.variantId === ownVariantId && m.quantity === 1,
    );
    expect(created).toBeDefined();
    expect(created!.unitPrice).toBe(28.25);

    const switched = await request(app)
      .patch(`/api/work-orders/${workOrderId}/materials/${created!.id}`)
      .set(auth(adminToken))
      .send({ variantId: ownVariantId2 });
    expect(switched.status).toBe(200);
    const line = materialsOf(switched.body).find((m) => m.id === created!.id);
    expect(line!.variantId).toBe(ownVariantId2);
    expect(line!.unitPrice).toBe(40); // re-resolved selling price
    expect(line!.costPrice).toBe(25); // re-resolved cost (admin view)
    // Clean up so it doesn't skew later assertions.
    await request(app)
      .delete(`/api/work-orders/${workOrderId}/materials/${created!.id}`)
      .set(auth(adminToken));
  });

  it("a technician cannot inject a price via variant switch (server owns it)", async () => {
    const added = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: ownVariantId, quantity: 1 });
    const created = materialsOf(added.body).find(
      (m) => m.variantId === ownVariantId && m.quantity === 1,
    )!;
    // Technician sends a bogus unitPrice alongside a variant switch.
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}/materials/${created.id}`)
      .set(auth(technicianToken))
      .send({ variantId: ownVariantId2, unitPrice: 1 });
    expect(res.status).toBe(200);
    // Admin re-reads: price is the VARIANT's, not the injected 1.
    const adminView = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken));
    const line = materialsOf(adminView.body).find((m) => m.id === created.id);
    expect(line!.unitPrice).toBe(40);
    await request(app)
      .delete(`/api/work-orders/${workOrderId}/materials/${created.id}`)
      .set(auth(adminToken));
  });

  it("zone status derives from its lines: done when all named lines are done", async () => {
    // Fresh zone with one line, toggle it done → task.done should become true.
    const woWithZone = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks`)
      .set(auth(adminToken))
      .send({});
    const zone = woWithZone.body.tasks[woWithZone.body.tasks.length - 1];
    const withLine = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${zone.id}/materials/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: ownVariantId, quantity: 1 });
    const zoneAfterAdd = withLine.body.tasks.find(
      (z: { id: string; done: boolean }) => z.id === zone.id,
    );
    expect(zoneAfterAdd.done).toBe(false); // not-done line → zone not done

    const lineId = (withLine.body.tasks.find(
      (z: { id: string; materials: MaterialDto[] }) => z.id === zone.id,
    ).materials as MaterialDto[])[0].id;
    const toggled = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${lineId}/toggle`)
      .set(auth(adminToken));
    const zoneAfterToggle = toggled.body.tasks.find(
      (z: { id: string; done: boolean }) => z.id === zone.id,
    );
    expect(zoneAfterToggle.done).toBe(true); // all named lines done → zone done

    await request(app)
      .delete(`/api/work-orders/${workOrderId}/tasks/${zone.id}`)
      .set(auth(adminToken));
  });
});

describe("quote (offerte) PDF export", () => {
  it("admin export streams a PDF and persists a stable quote number", async () => {
    const first = await request(app)
      .get(`/api/work-orders/${workOrderId}/quote-pdf`)
      .set(auth(adminToken))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(first.status).toBe(200);
    expect(first.headers["content-type"]).toContain("application/pdf");
    const pdf = first.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);

    const wo1 = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(wo1.quoteNumber).toMatch(/^\d{8}$/);
    expect(wo1.quoteNumber!.startsWith(String(new Date().getFullYear()))).toBe(true);
    expect(wo1.quoteDate).not.toBeNull();
    expect(first.headers["content-disposition"]).toContain(`offerte-${wo1.quoteNumber}.pdf`);

    // Second export: number unchanged (the customer's copy keeps its identity).
    const second = await request(app)
      .get(`/api/work-orders/${workOrderId}/quote-pdf`)
      .set(auth(adminToken));
    expect(second.status).toBe(200);
    const wo2 = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(wo2.quoteNumber).toBe(wo1.quoteNumber);
  });

  it("technician export is forbidden (403)", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/quote-pdf`)
      .set(auth(technicianToken));
    expect(res.status).toBe(403);
  });
});

describe("delete werkbon", () => {
  it("deletes a werkbon that has priced lines (no post-delete recompute crash)", async () => {
    // A throwaway werkbon with a task + a material line — the exact shape that
    // previously crashed (recomputeQuoteAmount ran on the just-deleted werkbon).
    const created = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId, title: `${TAG} to-delete` });
    const delId = created.body.id;
    const withTask = await request(app)
      .post(`/api/work-orders/${delId}/tasks`)
      .set(auth(adminToken))
      .send({});
    const delTaskId = withTask.body.tasks[0].id;
    await request(app)
      .post(`/api/work-orders/${delId}/tasks/${delTaskId}/materials/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: ownVariantId, quantity: 2 });

    const del = await request(app)
      .delete(`/api/work-orders/${delId}`)
      .set(auth(adminToken));
    expect(del.status).toBe(204);
    expect(await prisma.workOrder.findUnique({ where: { id: delId } })).toBeNull();
  });

  it("technician cannot delete a werkbon (403)", async () => {
    const res = await request(app)
      .delete(`/api/work-orders/${workOrderId}`)
      .set(auth(technicianToken));
    expect(res.status).toBe(403);
  });
});
