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
          { size: "60", component: "elbow", unit: "piece", unitPrice: 28.25, ordinal: 0 },
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
  await prisma.organization.update({
    where: { id: orgId },
    data: { hidePricesFromTechnicians: true },
  });
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
