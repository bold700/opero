import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// A werkbon's schedule lives in TWO stores: WorkOrder.plannedDate (what the
// werkbon detail reads) and PlanningItem (what the calendar draws, and which
// SHADOWS plannedDate). Writing one without the other let the two screens
// disagree — the werkbon showing 14 Oct while the calendar drew the stale slot
// on 3 May. Both entry points now go through planning/schedule.ts.

const TAG = "wo-schedsync";
let orgId: string;
let adminToken: string;
let techToken: string;
let projectId: string;
let workOrderId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// The calendar feed's view of this werkbon.
async function calendarEntries(date?: string) {
  const q = date ? `?from=${date}&to=${date}` : "?from=2020-01-01&to=2099-12-31";
  const res = await request(app).get(`/api/planning${q}`).set(auth(adminToken));
  return (res.body as { workOrderId: string; date: string }[]).filter(
    (e) => e.workOrderId === workOrderId,
  );
}

async function slots() {
  return prisma.planningItem.findMany({
    where: { workOrderId },
    orderBy: { date: "asc" },
  });
}

async function workOrderRow() {
  return prisma.workOrder.findUniqueOrThrow({
    where: { id: workOrderId },
    select: { plannedDate: true, plannedEndDate: true },
  });
}

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
    data: { orgId, name: `${TAG} Tech`, phone: "0600000000", roles: ["Technician"] },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-m@opero.test`, passwordHash: pw, name: "M", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;

  const woRes = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderId = woRes.body.id;
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { assignees: { connect: { id: techEmp.id } } },
  });
});

// Each test starts from "scheduled via the Planning screen on 2030-05-03",
// which is the state that used to break: a slot exists, so it shadows any
// plannedDate the werkbon PATCH writes.
beforeEach(async () => {
  await prisma.planningItem.deleteMany({ where: { workOrderId } });
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { plannedDate: null, plannedEndDate: null },
  });
  await request(app)
    .post(`/api/planning/work-orders/${workOrderId}/planning`)
    .set(auth(adminToken))
    .send({ date: "2030-05-03" });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("werkbon PATCH keeps the planning calendar in sync", () => {
  it("moving the date moves the existing slot (was: calendar kept the old date)", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ plannedDate: "2030-10-14" });
    expect(res.status).toBe(200);

    expect((await workOrderRow()).plannedDate).toBe("2030-10-14");
    expect((await slots()).map((s) => s.date)).toEqual(["2030-10-14"]);

    // The regression itself: nothing left on the old day, one entry on the new.
    expect(await calendarEntries("2030-05-03")).toHaveLength(0);
    expect(await calendarEntries("2030-10-14")).toHaveLength(1);
  });

  it("keeps the slot's times, crew and vehicle when only the date moves", async () => {
    const before = (await slots())[0];
    await prisma.planningItem.update({
      where: { id: before.id },
      data: { startTime: "07:15", endTime: "16:45", vehicle: "Bus 7" },
    });

    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ plannedDate: "2030-10-14" });

    const after = (await slots())[0];
    expect(after.date).toBe("2030-10-14");
    expect(after.startTime).toBe("07:15");
    expect(after.endTime).toBe("16:45");
    expect(after.vehicle).toBe("Bus 7");
  });

  it("creates a slot for a werkbon that was never on the planning", async () => {
    await prisma.planningItem.deleteMany({ where: { workOrderId } });
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { plannedDate: null, plannedEndDate: null },
    });

    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ plannedDate: "2030-10-14" });

    const created = await slots();
    expect(created).toHaveLength(1);
    expect(created[0].date).toBe("2030-10-14");
    // Store defaults, so the calendar entry has real times rather than a bare day.
    expect(created[0].startTime).toBe("08:00");
    expect(created[0].endTime).toBe("15:30");
    expect(await calendarEntries("2030-10-14")).toHaveLength(1);
  });

  it("clearing the date removes the slot and drops it off the calendar", async () => {
    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ plannedDate: "" });

    expect((await workOrderRow()).plannedDate).toBeNull();
    expect(await slots()).toHaveLength(0);
    expect(await calendarEntries()).toHaveLength(0);
  });

  it("setting only the end date keeps the slot on the start date", async () => {
    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ plannedEndDate: "2030-05-06" });

    const row = await workOrderRow();
    expect(row.plannedDate).toBe("2030-05-03");
    expect(row.plannedEndDate).toBe("2030-05-06");
    // Multi-day is ONE slot on the start date + a range, not a slot per day.
    expect((await slots()).map((s) => s.date)).toEqual(["2030-05-03"]);
  });

  it("a start+end patch sets the range explicitly", async () => {
    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ plannedDate: "2030-10-14", plannedEndDate: "2030-10-16" });

    const row = await workOrderRow();
    expect(row.plannedDate).toBe("2030-10-14");
    expect(row.plannedEndDate).toBe("2030-10-16");
    expect((await slots()).map((s) => s.date)).toEqual(["2030-10-14"]);
  });

  it("a non-schedule patch leaves the planning untouched", async () => {
    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken))
      .send({ title: `${TAG} renamed` });

    expect((await workOrderRow()).plannedDate).toBe("2030-05-03");
    expect((await slots()).map((s) => s.date)).toEqual(["2030-05-03"]);
  });

  it("a technician still cannot change the schedule (403)", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(auth(techToken))
      .send({ plannedDate: "2030-10-14" });
    expect(res.status).toBe(403);
    expect((await workOrderRow()).plannedDate).toBe("2030-05-03");
  });
});

describe("the planning route still drives the werkbon (other direction)", () => {
  it("scheduling via planning sets the werkbon's plannedDate", async () => {
    await request(app)
      .post(`/api/planning/work-orders/${workOrderId}/planning`)
      .set(auth(adminToken))
      .send({ date: "2030-11-20" });

    expect((await workOrderRow()).plannedDate).toBe("2030-11-20");
    expect((await slots()).map((s) => s.date)).toEqual(["2030-11-20"]);
  });

  it("unscheduling via planning clears the werkbon's dates", async () => {
    await request(app)
      .delete(`/api/planning/work-orders/${workOrderId}/planning`)
      .set(auth(adminToken));

    expect((await workOrderRow()).plannedDate).toBeNull();
    expect(await slots()).toHaveLength(0);
  });
});
