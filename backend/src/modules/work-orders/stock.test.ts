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

// BOLD700 #12 / meeting §5: handed out vs. used vs. returned, registered by
// the technician on the werkbon line; on-location returns without an issue.
const TAG = "stock-reg";
let lineId: string;
beforeAll(async () => {
  await setup(TAG);
  const res = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(adminToken))
    .send({ name: "Armaflex 22mm", quantity: 100, unit: "meter" });
  lineId = linesOf(res.body).find((l) => l.name === "Armaflex 22mm")!.id;
});
afterAll(() => teardown(TAG));

describe("stock registration on a line", () => {
  it("technician registers 120 handed out, 100 used, 5 returned", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${lineId}/usage`)
      .set(auth(techToken))
      .send({ issued: 120, used: 100, returned: 5 });
    expect(res.status).toBe(200);
    const line = linesOf(res.body).find((l) => l.id === lineId)!;
    expect(line.issuedQuantity).toBe(120);
    expect(line.usedQuantity).toBe(100);
    expect(line.returnedQuantity).toBe(5);
    // 120 − 100 − 5 = 15 unaccounted (derived client-side from these three).
    expect(line.issuedQuantity! - line.usedQuantity! - line.returnedQuantity!).toBe(15);
  });

  it("a later partial update keeps the other numbers", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${lineId}/usage`)
      .set(auth(techToken))
      .send({ returned: 20 });
    const line = linesOf(res.body).find((l) => l.id === lineId)!;
    expect(line.issuedQuantity).toBe(120);
    expect(line.usedQuantity).toBe(100);
    expect(line.returnedQuantity).toBe(20);
  });

  it("on-location delivery: a return registers without a hand-out amount", async () => {
    const add = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
      .set(auth(adminToken))
      .send({ name: "Op locatie geleverd", quantity: 50, unit: "meter" });
    const onSite = linesOf(add.body).find((l) => l.name === "Op locatie geleverd")!;
    await prisma.taskMaterial.update({ where: { id: onSite.id }, data: { onSite: true } });
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${onSite.id}/usage`)
      .set(auth(techToken))
      .send({ returned: 7 });
    expect(res.status).toBe(200);
    const line = linesOf(res.body).find((l) => l.id === onSite.id)!;
    expect(line.issuedQuantity).toBeUndefined();
    expect(line.returnedQuantity).toBe(7);
  });

  it("an empty registration is rejected (400); an unassigned technician gets 404", async () => {
    const empty = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${lineId}/usage`)
      .set(auth(techToken))
      .send({});
    expect(empty.status).toBe(400);
    const outsider = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${lineId}/usage`)
      .set(auth(outsiderToken))
      .send({ used: 1 });
    expect(outsider.status).toBe(404);
  });
});
