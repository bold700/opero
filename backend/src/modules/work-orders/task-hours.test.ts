import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Time registration on a zone: start → end computes hours from the elapsed
// time, and a manual PATCH overrides the total. An ASSIGNED technician must be
// able to do all three (that is the point of the feature — they log their own
// hours); an unassigned one must not see the work order at all.

const TAG = "task-hours";
let orgId: string;
let adminToken: string;
let technicianToken: string;
let outsiderToken: string;
let projectId: string;
let employeeId: string;
let workOrderId: string;
let taskId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const taskOf = (body: { tasks: { id: string; hours?: number; startedAt?: string; endedAt?: string }[] }) =>
  body.tasks.find((t) => t.id === taskId);

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

  // Technician linked to an employee assigned as installer on the project.
  const employee = await prisma.employee.create({
    data: { orgId, name: `${TAG}-tech`, phone: "0", role: "Technician", status: "active" },
  });
  employeeId = employee.id;
  const technician = await prisma.user.create({
    data: {
      orgId, email: `${TAG}-t@opero.test`, passwordHash: pw, name: "T",
      role: "technician", status: "active", employeeId,
    },
  });
  technicianToken = signAccessToken({ sub: technician.id, role: "technician", orgId });

  // A technician with NO assignment on this project.
  const outsiderEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG}-outsider`, phone: "0", role: "Technician", status: "active" },
  });
  const outsider = await prisma.user.create({
    data: {
      orgId, email: `${TAG}-o@opero.test`, passwordHash: pw, name: "O",
      role: "technician", status: "active", employeeId: outsiderEmp.id,
    },
  });
  outsiderToken = signAccessToken({ sub: outsider.id, role: "technician", orgId });

  const customer = await prisma.customer.create({
    data: {
      orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl",
      phone: "", address: "", postalCode: "", city: "",
    },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { connect: { id: employeeId } } },
  });

  const wo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId });
  workOrderId = wo.body.id;
  // Assignment is per WERKBON, not per project — put the technician on this
  // werkbon's crew, which is what grants them access.
  await prisma.workOrder.update({
    where: { id: workOrderId },
    // Assigned AND dispatched: technician writes are gated on dispatch.
    data: { assignees: { connect: { id: employeeId } }, dispatchedAt: new Date() },
  });
  const withTask = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({});
  taskId = withTask.body.tasks[0].id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("task hours — assigned technician", () => {
  it("can start the clock", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/start`)
      .set(auth(technicianToken));
    expect(res.status).toBe(200);
    expect(taskOf(res.body)?.startedAt).toBeTruthy();
  });

  it("can stop the clock — hours are computed server-side and the task is done", async () => {
    // Backdate the start so the elapsed time rounds to a non-zero quarter hour.
    const startedAt = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // 1.5h ago
    await prisma.workOrderTask.update({ where: { id: taskId }, data: { startedAt } });

    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/end`)
      .set(auth(technicianToken));
    expect(res.status).toBe(200);
    const task = taskOf(res.body);
    expect(task?.endedAt).toBeTruthy();
    expect(task?.hours).toBe(1.5);

    const row = await prisma.workOrderTask.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.hours).toBe(1.5);
    expect(row.done).toBe(true);
  });

  it("can override the total by hand", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}/tasks/${taskId}/hours`)
      .set(auth(technicianToken))
      .send({ hours: 4.25 });
    expect(res.status).toBe(200);
    expect(taskOf(res.body)?.hours).toBe(4.25);
  });
});

describe("task hours — access control", () => {
  it("a technician NOT assigned to the project cannot log hours (404)", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/start`)
      .set(auth(outsiderToken));
    expect(res.status).toBe(404);
  });

  it("admin can also log hours", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}/tasks/${taskId}/hours`)
      .set(auth(adminToken))
      .send({ hours: 2 });
    expect(res.status).toBe(200);
    expect(taskOf(res.body)?.hours).toBe(2);
  });
});
