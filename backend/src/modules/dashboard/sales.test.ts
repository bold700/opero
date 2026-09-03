import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
type Line = {
  id: string; name: string; unit: string; quantity: number; done: boolean;
  unitPrice?: number; costPrice?: number;
  usedQuantity?: number; issuedQuantity?: number; returnedQuantity?: number;
};
const linesOf = (body: { tasks: { materials: Line[] }[] }): Line[] =>
  body.tasks.flatMap((t) => t.materials);

let orgId: string;
let adminToken: string;
let techToken: string;
let outsiderToken: string;
let projectId: string;
let workOrderId: string;
let taskId: string;

async function setup(TAG: string) {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
  const techEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG}-tech`, phone: "0", role: "Technician", status: "active" },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-t@opero.test`, passwordHash: pw, name: "T", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });
  const outEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG}-out`, phone: "0", role: "Technician", status: "active" },
  });
  const outsider = await prisma.user.create({
    data: { orgId, email: `${TAG}-o@opero.test`, passwordHash: pw, name: "O", role: "technician", status: "active", employeeId: outEmp.id },
  });
  outsiderToken = signAccessToken({ sub: outsider.id, role: "technician", orgId });
  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const proj = await request(app).post("/api/projects").set(auth(adminToken)).send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = proj.body.id;
  const wo = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderId = wo.body.id;
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { assignees: { connect: { id: techEmp.id } }, dispatchedAt: new Date() },
  });
  const withTask = await request(app).post(`/api/work-orders/${workOrderId}/tasks`).set(auth(adminToken)).send({});
  taskId = withTask.body.tasks[0].id;
}

async function teardown(TAG: string) {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.article.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
}

// BOLD700 #14 / meeting §5b: sold, cost, profit and laid metres on the admin
// dashboard, checked as DELTAS against known lines (the org has seed data).
const TAG = "dash-sales";
type Sales = { sold: number; cost: number; profit: number; metersLaid: number };
const sales = async (): Promise<Sales> =>
  (await request(app).get("/api/dashboard").set(auth(adminToken))).body.sales;

beforeAll(async () => {
  await setup(TAG);
});
afterAll(() => teardown(TAG));

describe("dashboard sales & usage", () => {
  it("a 10 m line at €10 with €6 cost, 8 m used → +100 sold, +60 cost, +40 profit, +8 m", async () => {
    const before = await sales();
    const add = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
      .set(auth(adminToken))
      .send({ name: `${TAG} leiding`, quantity: 10, unit: "meter", unitPrice: 10 });
    const line = linesOf(add.body).find((l) => l.name === `${TAG} leiding`)!;
    // Cost is snapshotted from the catalog on catalog lines; set it directly
    // here so the profit arithmetic is checked in isolation.
    await prisma.taskMaterial.update({ where: { id: line.id }, data: { costPrice: 6 } });
    await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${line.id}/usage`)
      .set(auth(techToken))
      .send({ used: 8 });
    const after = await sales();
    expect(after.sold - before.sold).toBeCloseTo(100, 6);
    expect(after.cost - before.cost).toBeCloseTo(60, 6);
    expect(after.profit - before.profit).toBeCloseTo(40, 6);
    expect(after.metersLaid - before.metersLaid).toBeCloseTo(8, 6);
  });

  it("a piece line adds money but no metres; unapproved meerwerk adds nothing", async () => {
    const before = await sales();
    await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
      .set(auth(adminToken))
      .send({ name: `${TAG} bocht`, quantity: 4, unit: "stuk", unitPrice: 5 });
    await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
      .set(auth(adminToken))
      .send({ name: `${TAG} meerwerk`, quantity: 3, unit: "meter", unitPrice: 100, isExtraWork: true });
    const after = await sales();
    expect(after.sold - before.sold).toBeCloseTo(20, 6);
    expect(after.metersLaid - before.metersLaid).toBeCloseTo(0, 6);
  });

  it("the technician dashboard carries no sales block", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    expect(res.status).toBe(200);
    expect(res.body.sales).toBeUndefined();
  });
});
