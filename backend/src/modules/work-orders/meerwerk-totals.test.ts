import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// THE MONEY MATH for meerwerk, now that it's a TaskMaterial line with
// `isExtraWork` rather than its own entity.
//
// Two pools that must stay DISJOINT and are summed into the invoice total:
//   WorkOrder.value / Quote.amount  ← non-meerwerk lines, unconditionally
//   Invoice.extraWorkAmount         ← meerwerk lines, ONLY when both approved
//
// If a meerwerk line ever lands in both, every invoice double-bills. That is
// the regression these tests exist to catch.

const TAG = "mwtotals-test";
let orgId: string;
let adminToken: string;
let clientToken: string;
let projectId: string;
let customerId: string;
let workOrderId: string;
let taskId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const workOrderValue = () =>
  prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, select: { value: true } });

// Draft the invoice (this is what runs deriveTotals) and return its body.
const draftInvoice = async () => {
  const res = await request(app)
    .post(`/api/work-orders/${workOrderId}/invoice/draft`)
    .set(auth(adminToken));
  expect(res.status).toBe(200);
  return res.body as {
    acceptedQuoteAmount: number;
    extraWorkAmount: number;
    total: number;
  };
};

// Add a line to the zone. `isExtraWork` flags it as meerwerk.
const addLine = async (
  token: string,
  body: { name: string; quantity: number; unit: string; unitPrice?: number; isExtraWork?: boolean },
) =>
  request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(token))
    .send(body);

const lineIdByName = async (name: string) => {
  const m = await prisma.taskMaterial.findFirstOrThrow({
    where: { taskId, name },
    select: { id: true },
  });
  return m.id;
};

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;

  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  // Own customer + project — suites must never borrow seeded data.
  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const project = await prisma.project.create({
    data: { orgId, customerId: customer.id, customerName: customer.name, name: `${TAG} Project`, projectNumber: `${TAG}-P1`, insulationType: "", nextStepKey: "sendQuote", address: "", postalCode: "", city: "" },
  });
  projectId = project.id;
  customerId = customer.id;

  // A client login that owns this project's customer — the only role that can
  // give client approval.
  const client = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-c@opero.test`,
      passwordHash: pw,
      name: "C",
      role: "client",
      status: "active",
      customerId,
    },
  });
  clientToken = signAccessToken({ sub: client.id, role: "client", orgId });

  const wo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId, title: `${TAG} WO` });
  workOrderId = wo.body.id;

  const withTask = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({ description: `${TAG} zone` });
  taskId = withTask.body.tasks[0].id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("meerwerk invoice totals", () => {
  it("keeps unapproved meerwerk out of the werkbon value, the quote AND the invoice", async () => {
    // €100 of sold work + €250 of meerwerk nobody has approved yet.
    expect((await addLine(adminToken, { name: `${TAG} sold`, quantity: 2, unit: "meter", unitPrice: 50 })).status).toBe(201);
    expect(
      (await addLine(adminToken, {
        name: `${TAG} mw`,
        quantity: 5,
        unit: "meter",
        unitPrice: 50,
        isExtraWork: true,
      })).status,
    ).toBe(201);

    // The sold scope is €100 — the meerwerk must NOT have moved it.
    expect((await workOrderValue()).value).toBe(100);

    const inv = await draftInvoice();
    expect(inv.acceptedQuoteAmount).toBe(100);
    expect(inv.extraWorkAmount).toBe(0);
    expect(inv.total).toBe(100);
  });

  it("bills approved meerwerk EXACTLY ONCE (double-billing regression)", async () => {
    const mwId = await lineIdByName(`${TAG} mw`);

    await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${mwId}/approve-office`)
      .set(auth(adminToken))
      .expect(200);
    await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${mwId}/approve-client`)
      .set(auth(clientToken))
      .expect(200);

    // The quoted amount must be UNCHANGED by an approval — approving meerwerk
    // doesn't retroactively change what was sold.
    expect((await workOrderValue()).value).toBe(100);

    const inv = await draftInvoice();
    expect(inv.acceptedQuoteAmount).toBe(100);
    expect(inv.extraWorkAmount).toBe(250);
    // 100 + 250, NOT 100 + 250 + 250.
    expect(inv.total).toBe(350);
  });

  it("drops rejected meerwerk back out of the invoice", async () => {
    const mwId = await lineIdByName(`${TAG} mw`);
    await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${mwId}/reject`)
      .set(auth(adminToken))
      .send({ by: "office" })
      .expect(200);

    const inv = await draftInvoice();
    expect(inv.extraWorkAmount).toBe(0);
    expect(inv.total).toBe(100);
  });

  it("resets both approvals when an approved meerwerk line is edited", async () => {
    const mwId = await lineIdByName(`${TAG} mw`);
    // Clear the rejection and re-approve both sides.
    await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${mwId}/approve-office`)
      .set(auth(adminToken))
      .expect(200);
    await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${mwId}/approve-client`)
      .set(auth(clientToken))
      .expect(200);
    expect(await draftInvoice()).toMatchObject({ extraWorkAmount: 250 });

    // Changing the line changes what's being agreed → consent is stale.
    await request(app)
      .patch(`/api/work-orders/${workOrderId}/materials/${mwId}`)
      .set(auth(adminToken))
      .send({ quantity: 9 })
      .expect(200);

    const line = await prisma.taskMaterial.findUniqueOrThrow({ where: { id: mwId } });
    expect(line.approvedByOffice).toBe(false);
    expect(line.approvedByClient).toBe(false);

    const inv = await draftInvoice();
    expect(inv.extraWorkAmount).toBe(0);
  });

  it("lets a technician add meerwerk but not sold-scope lines", async () => {
    // The quote-scope guard exists because sold lines move the invoiced amount.
    // Meerwerk doesn't (it's gated behind approval), so a technician may report
    // it — that's the whole point of meerwerk.
    const employee = await prisma.employee.create({
      data: { orgId, name: `${TAG}-tech`, phone: "0", role: "Technician", status: "active" },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { installers: { connect: { id: employee.id } } },
    });
    // Assignment is per WERKBON, not per project — that's what grants access.
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { assignees: { connect: { id: employee.id } }, dispatchedAt: new Date() },
    });
    const techUser = await prisma.user.create({
      data: {
        orgId,
        email: `${TAG}-t@opero.test`,
        passwordHash: await hashPassword("x"),
        name: "T",
        role: "technician",
        status: "active",
        employeeId: employee.id,
      },
    });
    const techToken = signAccessToken({ sub: techUser.id, role: "technician", orgId });

    // Sold scope: forbidden.
    expect((await addLine(techToken, { name: `${TAG} nope`, quantity: 1, unit: "meter" })).status).toBe(403);
    // Meerwerk: allowed.
    expect(
      (await addLine(techToken, { name: `${TAG} tech-mw`, quantity: 1, unit: "meter", isExtraWork: true })).status,
    ).toBe(201);

    // And a technician's meerwerk carries no price (they never see prices).
    const line = await prisma.taskMaterial.findFirstOrThrow({ where: { taskId, name: `${TAG} tech-mw` } });
    expect(line.unitPrice ?? 0).toBe(0);
    // Still no effect on the sold scope.
    expect((await workOrderValue()).value).toBe(100);

    await prisma.project.update({
      where: { id: projectId },
      data: { installers: { disconnect: { id: employee.id } } },
    });
    await prisma.user.deleteMany({ where: { id: techUser.id } });
    await prisma.employee.deleteMany({ where: { id: employee.id } });
  });
});
