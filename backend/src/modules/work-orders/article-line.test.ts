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

// BOLD700 #13 / meeting §5 "Materials": products and services (e.g. hours)
// from the article catalog, added to a werkbon as a priced line.
const TAG = "article-line";
let articleId: string;
beforeAll(async () => {
  await setup(TAG);
});
afterAll(() => teardown(TAG));

describe("products & services on a werkbon", () => {
  it("office adds an hours article to the catalog", async () => {
    const res = await request(app)
      .post("/api/materials/articles")
      .set(auth(adminToken))
      .send({ category: "labor", name: `${TAG} Montage-uur`, unit: "uur", unitPrice: 65, defaultQuantity: 1 });
    expect(res.status).toBe(201);
    articleId = res.body.id;
    expect(res.body.category).toBe("labor");
  });

  it("office adds it to a werkbon: name, unit and price resolve server-side", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-article`)
      .set(auth(adminToken))
      .send({ articleId, quantity: 8 });
    expect(res.status).toBe(201);
    const line = linesOf(res.body).find((l) => l.name === `${TAG} Montage-uur`)!;
    expect(line.unit).toBe("uur");
    expect(line.quantity).toBe(8);
    expect(line.unitPrice).toBe(65);
  });

  it("the technician sees the line without a price, and can add it only as meerwerk", async () => {
    const view = await request(app).get(`/api/work-orders/${workOrderId}`).set(auth(techToken));
    const line = linesOf(view.body).find((l) => l.name === `${TAG} Montage-uur`)!;
    expect(line).toBeDefined();
    expect(line.unitPrice).toBeUndefined();

    const sold = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-article`)
      .set(auth(techToken))
      .send({ articleId, quantity: 1 });
    expect(sold.status).toBe(403);

    const extra = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-article`)
      .set(auth(techToken))
      .send({ articleId, quantity: 2, isExtraWork: true });
    expect(extra.status).toBe(201);
  });

  it("an article from another org is not found", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials/from-article`)
      .set(auth(adminToken))
      .send({ articleId: "00000000-0000-0000-0000-000000000000", quantity: 1 });
    expect(res.status).toBe(404);
  });
});
