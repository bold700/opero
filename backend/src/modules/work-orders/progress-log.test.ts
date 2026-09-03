import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Per-day progress logging on a werkbon line. Verifies:
//   - a technician logs an amount → the entry records WHO and WHICH DAY, and
//     the DTO carries progressTotal + entries (with the employee's name);
//   - reaching the line's target quantity marks the line done;
//   - the office can delete a mistyped entry; a technician cannot;
//   - the bell: the technician gets a progressReminder for a dispatched,
//     planned werkbon with nothing logged today, which disappears after
//     logging; the office gets a progressLogged item.

const TAG = "progress-log";
let orgId: string;
let adminToken: string;
let technicianToken: string;
let employeeId: string;
let projectId: string;
let workOrderId: string;
let taskId: string;
let materialId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const today = new Date().toISOString().slice(0, 10);

type Line = {
  id: string;
  done: boolean;
  progressTotal: number;
  progressEntries: { id: string; amount: number; day: string; employeeName?: string }[];
};
const lineOf = (body: { tasks: { materials: Line[] }[] }): Line =>
  body.tasks.flatMap((t) => t.materials).find((m) => m.id === materialId)!;

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
  await prisma.workOrder.update({
    where: { id: workOrderId },
    // Assigned, dispatched AND planned in the past → reminder-eligible.
    data: {
      assignees: { connect: { id: employeeId } },
      dispatchedAt: new Date(),
      plannedDate: today,
    },
  });
  const withTask = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({});
  taskId = withTask.body.tasks[0].id;

  // A 100 m line to log against.
  const withLine = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(adminToken))
    .send({ name: "Leiding isoleren", quantity: 100, unit: "m" });
  const lines = (withLine.body.tasks as { materials: (Line & { name: string })[] }[])
    .flatMap((t) => t.materials);
  materialId = lines.find((m) => m.name === "Leiding isoleren")!.id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("progress logging", () => {
  it("the technician's bell reminds before anything is logged today", async () => {
    const res = await request(app).get("/api/notifications").set(auth(technicianToken));
    expect(res.status).toBe(200);
    const reminder = res.body.items.find(
      (i: { category: string }) => i.category === "progressReminder",
    );
    expect(reminder).toBeDefined();
  });

  it("technician logs 10 of 100 — who and day recorded", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${materialId}/progress`)
      .set(auth(technicianToken))
      .send({ amount: 10 });
    expect(res.status).toBe(201);
    const line = lineOf(res.body);
    expect(line.progressTotal).toBe(10);
    expect(line.progressEntries).toHaveLength(1);
    expect(line.progressEntries[0].day).toBe(today);
    expect(line.progressEntries[0].employeeName).toBe(`${TAG}-tech`);
    expect(line.done).toBe(false);
  });

  it("the reminder disappears once progress is logged today", async () => {
    const res = await request(app).get("/api/notifications").set(auth(technicianToken));
    const reminder = res.body.items.find(
      (i: { category: string }) => i.category === "progressReminder",
    );
    expect(reminder).toBeUndefined();
  });

  it("the office bell carries the progressLogged item", async () => {
    const res = await request(app).get("/api/notifications").set(auth(adminToken));
    expect(res.status).toBe(200);
    const item = res.body.items.find(
      (i: { category: string }) => i.category === "progressLogged",
    );
    expect(item).toBeDefined();
    expect(item.params.amount).toBe(10);
  });

  it("reaching the target marks the line done", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/materials/${materialId}/progress`)
      .set(auth(technicianToken))
      .send({ amount: 90, day: today });
    expect(res.status).toBe(201);
    const line = lineOf(res.body);
    expect(line.progressTotal).toBe(100);
    expect(line.done).toBe(true);
  });

  it("a technician cannot delete an entry; the office can", async () => {
    const wo = await request(app).get(`/api/work-orders/${workOrderId}`).set(auth(adminToken));
    const entryId = lineOf(wo.body).progressEntries[0].id;

    const denied = await request(app)
      .delete(`/api/work-orders/${workOrderId}/materials/${materialId}/progress/${entryId}`)
      .set(auth(technicianToken));
    expect(denied.status).toBe(403);

    const removed = await request(app)
      .delete(`/api/work-orders/${workOrderId}/materials/${materialId}/progress/${entryId}`)
      .set(auth(adminToken));
    expect(removed.status).toBe(200);
    expect(lineOf(removed.body).progressTotal).toBe(90);
  });
});
