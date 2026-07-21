import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Meerwerk (extra work) pricing: catalog path resolves price server-side; the
// free-text path only honors a client price for admins (a technician's price is
// discarded). Mirrors the task-line price guarantees.

const TAG = "mwprice-test";
let orgId: string;
let adminToken: string;
let technicianToken: string;
let projectId: string;
let employeeId: string;
let workOrderId: string;
let variantId: string;
let variantId2: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type ExtraWorkDto = {
  id: string;
  name?: string;
  quantity?: number;
  unit?: string;
  variantId?: string;
  unitPrice?: number;
  amount?: number;
  costPrice?: number;
  margin?: number;
};
const extraWorkOf = (body: { extraWork: ExtraWorkDto[] }): ExtraWorkDto[] =>
  body.extraWork ?? [];

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;

  await prisma.material.deleteMany({ where: { key: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

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

  const wo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId, title: `${TAG} WO` });
  workOrderId = wo.body.id;

  const material = await prisma.material.create({
    data: {
      orgId,
      key: `${TAG}_material`,
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
          { size: "60", component: "elbow", unit: "piece", unitPrice: 28.25, costPrice: 20, ordinal: 0 },
          { size: "88", component: "elbow", unit: "piece", unitPrice: 40, costPrice: 25, ordinal: 1 },
        ],
      },
    },
    include: { variants: { orderBy: { ordinal: "asc" } } },
  });
  variantId = material.variants[0].id;
  variantId2 = material.variants[1].id;
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
  await prisma.$disconnect();
});

describe("meerwerk free-text pricing", () => {
  it("technician's client-supplied price is discarded (stored 0)", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work`)
      .set(auth(technicianToken))
      .send({ name: `${TAG} labor`, quantity: 2, unit: "uur", unitPrice: 999 });
    expect(res.status).toBe(201);

    // Read the raw row: price + amount must be zeroed regardless of the request.
    const row = await prisma.extraWork.findFirstOrThrow({
      where: { workOrderId, name: `${TAG} labor` },
    });
    expect(row.unitPrice).toBe(0);
    expect(row.amount).toBe(0);
  });

  it("admin's free-text price is honored", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work`)
      .set(auth(adminToken))
      .send({ name: `${TAG} adminwork`, quantity: 3, unit: "uur", unitPrice: 50 });
    expect(res.status).toBe(201);

    const row = await prisma.extraWork.findFirstOrThrow({
      where: { workOrderId, name: `${TAG} adminwork` },
    });
    expect(row.unitPrice).toBe(50);
    expect(row.amount).toBe(150); // 3 × 50
  });
});

describe("meerwerk from catalog", () => {
  it("resolves price/cost/name server-side; technician response strips price", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work/from-catalog`)
      .set(auth(technicianToken))
      .send({ variantId, quantity: 2 });
    expect(res.status).toBe(201);

    // Technician response: line present, price stripped.
    const techItem = extraWorkOf(res.body).find((m) => m.variantId === variantId);
    expect(techItem).toBeDefined();
    expect(techItem!.unitPrice).toBeUndefined();
    expect(techItem!.costPrice).toBeUndefined();

    // Raw row: price + cost snapshotted from the variant.
    const row = await prisma.extraWork.findFirstOrThrow({
      where: { workOrderId, variantId },
    });
    expect(row.unitPrice).toBe(28.25);
    expect(row.costPrice).toBe(20);
    expect(row.amount).toBe(57); // round(2 × 28.25) = 57
    expect(row.quantity).toBe(2);
  });

  it("admin sees selling price, cost and margin on the catalog meerwerk row", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken));
    const item = extraWorkOf(res.body).find((m) => m.variantId === variantId);
    expect(item).toBeDefined();
    expect(item!.unitPrice).toBe(28.25);
    expect(item!.costPrice).toBe(20);
    expect(item!.margin).toBe(16.5); // (28.25 − 20) × 2
  });

  it("rejects a variant from another org (404)", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: `${TAG}-other` } });
    const otherMat = await prisma.material.create({
      data: {
        orgId: otherOrg.id,
        key: `${TAG}_other_material`,
        name: `${TAG} other`,
        class: "insulation",
        supplier: `${TAG}-supplier`,
        sizeUnit: "pipe_od_mm",
        priceSource: `${TAG}-source`,
        ordinal: 999,
        variants: { create: [{ size: "60", component: "elbow", unit: "piece", unitPrice: 10, ordinal: 0 }] },
      },
      include: { variants: true },
    });
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work/from-catalog`)
      .set(auth(adminToken))
      .send({ variantId: otherMat.variants[0].id, quantity: 1 });
    expect(res.status).toBe(404);

    await prisma.material.deleteMany({ where: { key: `${TAG}_other_material` } });
    await prisma.organization.deleteMany({ where: { id: otherOrg.id } });
  });
});

describe("meerwerk edit (PATCH)", () => {
  // Fresh free-text row per test path.
  async function makeFreeTextRow(name: string): Promise<string> {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work`)
      .set(auth(adminToken))
      .send({ name, quantity: 1, unit: "uur", unitPrice: 10 });
    return extraWorkOf(res.body).find((m) => m.id && m.name?.startsWith(name))!.id;
  }

  it("technician editing a free-text row cannot set a price (stays discarded)", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work`)
      .set(auth(technicianToken))
      .send({ name: `${TAG} techedit`, quantity: 1, unit: "uur" });
    const id = extraWorkOf(res.body).find((m) => m.name === `${TAG} techedit`)!.id;

    await request(app)
      .patch(`/api/work-orders/${workOrderId}/extra-work/${id}`)
      .set(auth(technicianToken))
      .send({ quantity: 4, unitPrice: 999 })
      .expect(200);

    const row = await prisma.extraWork.findUniqueOrThrow({ where: { id } });
    expect(row.quantity).toBe(4);
    expect(row.unitPrice).toBe(0);
    expect(row.amount).toBe(0);
  });

  it("admin can price a free-text row via edit; amount recomputes", async () => {
    const id = await makeFreeTextRow(`${TAG} adminedit`);
    await request(app)
      .patch(`/api/work-orders/${workOrderId}/extra-work/${id}`)
      .set(auth(adminToken))
      .send({ quantity: 3, unitPrice: 50 })
      .expect(200);

    const row = await prisma.extraWork.findUniqueOrThrow({ where: { id } });
    expect(row.unitPrice).toBe(50);
    expect(row.amount).toBe(150);
  });

  it("re-pointing at a variant re-resolves name/price/cost server-side", async () => {
    const id = await makeFreeTextRow(`${TAG} repoint`);
    await request(app)
      .patch(`/api/work-orders/${workOrderId}/extra-work/${id}`)
      .set(auth(technicianToken))
      .send({ variantId: variantId2, quantity: 2 })
      .expect(200);

    const row = await prisma.extraWork.findUniqueOrThrow({ where: { id } });
    expect(row.variantId).toBe(variantId2);
    expect(row.unitPrice).toBe(40);
    expect(row.costPrice).toBe(25);
    expect(row.amount).toBe(80); // 2 × 40
    expect(row.label).toBeNull();
  });

  it("editing a row resets its approvals", async () => {
    const id = await makeFreeTextRow(`${TAG} approvedthenedit`);
    // Office approves it.
    await request(app)
      .post(`/api/work-orders/${workOrderId}/extra-work/${id}/approve-office`)
      .set(auth(adminToken))
      .expect(200);
    let row = await prisma.extraWork.findUniqueOrThrow({ where: { id } });
    expect(row.approvedByOffice).toBe(true);

    // Any edit clears approvals.
    await request(app)
      .patch(`/api/work-orders/${workOrderId}/extra-work/${id}`)
      .set(auth(adminToken))
      .send({ quantity: 5 })
      .expect(200);
    row = await prisma.extraWork.findUniqueOrThrow({ where: { id } });
    expect(row.approvedByOffice).toBe(false);
    expect(row.approvedByClient).toBe(false);
  });
});
