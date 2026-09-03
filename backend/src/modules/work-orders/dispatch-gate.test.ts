import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// THE DISPATCH GATE.
//
// A technician may VIEW an assigned werkbon before it is dispatched (planning
// transparency: tomorrow's job, address, drawings), but may not WRITE to it —
// the Controle vooraf checklist gates dispatch, and dispatch gates field work.
// Office/admin and foreman are NOT gated: they own or lead that flow.
//
// Both directions are pinned: undispatched blocks the technician (403 with the
// dispatch message, so "not yours" and "not yet released" stay distinguishable)
// and the SAME calls succeed the moment the werkbon is dispatched.

const TAG = "wo-dispatchgate";
let orgId: string;
let adminToken: string;
let techToken: string;
let foremanToken: string;
let workOrderId: string;
let taskId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const pngBytes = () =>
  Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

beforeAll(async () => {
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
    data: { orgId, name: `${TAG} Tech`, phone: "0", role: "Technician", status: "active" },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-m@opero.test`, passwordHash: pw, name: "M", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  const foremanEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Foreman`, phone: "0", role: "Foreman", status: "active" },
  });
  const foreman = await prisma.user.create({
    data: { orgId, email: `${TAG}-f@opero.test`, passwordHash: pw, name: "F", role: "foreman", status: "active", employeeId: foremanEmp.id },
  });
  foremanToken = signAccessToken({ sub: foreman.id, role: "foreman", orgId });

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  const projectId = projRes.body.id;

  const woRes = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId });
  workOrderId = woRes.body.id;
  // Assigned but deliberately NOT dispatched — the state under test.
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { assignees: { connect: { id: techEmp.id } } },
  });
  const taskRes = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({ description: `${TAG} zone` });
  taskId = taskRes.body.tasks.at(-1).id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("before dispatch", () => {
  it("the technician still SEES the werkbon (visibility is not the gate)", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
    expect(res.body.dispatchedAt).toBeFalsy();
    // The detail carries the werkbon's OWN status — the header badge reads
    // this, not the parent project's stage.
    expect(res.body.status).toBe("open");
  });

  it("list rows carry the release state so undispatched jobs are scannable", async () => {
    const res = await request(app)
      .get(`/api/work-orders`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    const row = res.body.items.find((r: { id: string }) => r.id === workOrderId);
    expect(row).toBeDefined();
    expect(row.dispatchedAt).toBeFalsy();
  });

  it("technician cannot tick a zone — 403 with the dispatch message", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}/tasks/${taskId}`)
      .set(auth(techToken))
      .send({ done: true });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/dispatched/i);
  });

  it("technician cannot finish the werkbon", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/finish`)
      .set(auth(techToken))
      .field("signedByName", "Klant")
      .attach("file", pngBytes(), "signature.png");
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/dispatched/i);
  });

  it("the foreman is NOT gated — the gate must not leak upward", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}/tasks/${taskId}`)
      .set(auth(foremanToken))
      .send({ note: `${TAG} foreman note` });
    expect(res.status).toBe(200);
  });
});

describe("after dispatch", () => {
  it("the same technician write succeeds once dispatched", async () => {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { dispatchedAt: new Date() },
    });
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}/tasks/${taskId}`)
      .set(auth(techToken))
      .send({ done: true });
    expect(res.status).toBe(200);
  });

  it("list rows report dispatchedAt once released", async () => {
    const res = await request(app)
      .get(`/api/work-orders`)
      .set(auth(adminToken));
    const row = res.body.items.find((r: { id: string }) => r.id === workOrderId);
    expect(row.dispatchedAt).toBeTruthy();
  });
});
