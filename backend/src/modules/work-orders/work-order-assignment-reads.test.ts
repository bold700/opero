import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Regression suite for the Project→WorkOrder migration. Assignment moved to
// WorkOrder.assignees (m:n), but several readers still looked only at the
// PROJECT-side relations (installers/teamLeader/projectLeader) or at the
// zone-level WorkOrderTask.assigneeId. A monteur dispatched the modern way —
// assigned to the WERKBON itself, on nobody's project crew, holding no task
// assignment — therefore fell through every one of them.
//
// The fixture is exactly that shape, deliberately minimal:
//   - werkbonOverdueId : planned in the PAST, listStatus "open" (not signed off)
//   - werkbonFutureId  : planned in the FUTURE
// Both are assigned via `assignees` ONLY. No installers connect, no task
// assigneeId anywhere. If any read regresses to a project- or task-only rule,
// it sees nothing at all here.

const TAG = "wo-assignreads";
const PAST = "2020-03-04"; // safely before today, and stable
const FUTURE = "2099-11-12"; // safely after today, and stable
// The dashboard compares against its own notion of "today", so this one has to
// be computed rather than hard-coded.
const TODAY = new Date().toISOString().slice(0, 10);

let orgId: string;
let techToken: string;
let techEmpId: string;
let overdueProjectId: string;
let futureProjectId: string;
let splitProjectId: string;
let undatedProjectId: string;
let werkbonOverdueId: string;
let werkbonFutureId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

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
  const adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const techEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Tech`, phone: "0600000000", role: "Technician" },
  });
  techEmpId = techEmp.id;
  const tech = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-m@opero.test`,
      passwordHash: pw,
      name: "M",
      role: "technician",
      status: "active",
      employeeId: techEmp.id,
    },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });

  // --- Project A: one OVERDUE werkbon, still open -----------------------
  const projA = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Overdue Project` });
  overdueProjectId = projA.body.id;

  const woOverdue = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: overdueProjectId });
  werkbonOverdueId = woOverdue.body.id;
  await prisma.workOrder.update({
    where: { id: werkbonOverdueId },
    // Assigned at the WERKBON level only, and explicitly NOT done.
    data: {
      assignees: { connect: { id: techEmpId } },
      plannedDate: PAST,
      listStatus: "open",
    },
  });
  // One open zone, with NO assigneeId — the dashboard's open-task count must
  // reach it through the werkbon assignment alone.
  await prisma.workOrderTask.create({
    data: { workOrderId: werkbonOverdueId, description: `${TAG} zone overdue`, done: false },
  });

  // --- Project B: one FUTURE werkbon ------------------------------------
  const projB = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Future Project` });
  futureProjectId = projB.body.id;

  const woFuture = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: futureProjectId });
  werkbonFutureId = woFuture.body.id;
  await prisma.workOrder.update({
    where: { id: werkbonFutureId },
    data: {
      assignees: { connect: { id: techEmpId } },
      plannedDate: FUTURE,
      listStatus: "open",
    },
  });

  // --- Project C: SPLIT — one overdue werkbon AND one planned today -------
  // Bucketing a project by a single derived date (the earliest) would file this
  // whole project under "overdue" and leave Today empty, hiding work the
  // technician is due on site for right now.
  const projC = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Split Project` });
  splitProjectId = projC.body.id;

  for (const date of [PAST, TODAY]) {
    const wo = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId: splitProjectId });
    await prisma.workOrder.update({
      where: { id: wo.body.id },
      data: {
        assignees: { connect: { id: techEmpId } },
        plannedDate: date,
        listStatus: "open",
      },
    });
  }

  // --- Project D: an UNDATED werkbon --------------------------------------
  // Assigned work that was never scheduled. The query deliberately includes it,
  // so it must surface on a bucket rather than being computed and then dropped.
  const projD = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Undated Project` });
  undatedProjectId = projD.body.id;

  const woUndated = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: undatedProjectId });
  await prisma.workOrder.update({
    where: { id: woUndated.body.id },
    data: {
      assignees: { connect: { id: techEmpId } },
      plannedDate: null,
      listStatus: "open",
    },
  });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

// --- FIX 5 ---------------------------------------------------------------
// The "Werkbonnen" column summed three PROJECT-side relations, so a monteur
// assigned only at werkbon level always read 0.
describe("employee list werkbon count", () => {
  it("counts werkbonnen assigned via WorkOrder.assignees", async () => {
    const adminUser = await prisma.user.findFirst({ where: { email: `${TAG}-a@opero.test` } });
    const adminToken = signAccessToken({ sub: adminUser!.id, role: "admin", orgId });

    const res = await request(app)
      .get(`/api/employees?search=${TAG}`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);

    const row = (res.body.items as { id: string; workOrderCount: number }[]).find(
      (e) => e.id === techEmpId,
    );
    expect(row).toBeDefined();
    // All five fixture werkbonnen are his (overdue, future, the split project's
    // two, and the undated one), and none is reachable via a project relation.
    // Exact, not a lower bound: the count regressing to 0 is the bug, but so is
    // it inflating by counting projects and werkbonnen together.
    expect(row!.workOrderCount).toBe(5);
  });
});

// --- FIX 6 ---------------------------------------------------------------
// The dashboard matched only `plannedDate >= today` or null, so a werkbon that
// slipped past its date disappeared entirely — along with its open tasks.
// The payload is ONE flat `projects` list (date buckets were removed), so these
// assert membership of that list rather than of a particular bucket.
const listedIds = (body: { projects: { id: string }[] }) =>
  new Set(body.projects.map((p) => p.id));

describe("technician dashboard", () => {
  it("still shows the project of a PAST-dated werkbon that is not signed off", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    expect(res.status).toBe(200);
    expect(listedIds(res.body).has(overdueProjectId)).toBe(true);
  });

  it("counts the open tasks of that past-dated werkbon", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    // The single open zone on the past-dated werkbon must survive; before the
    // fix the whole werkbon was filtered out and this was 0.
    expect(res.body.openTaskCount).toBe(1);
  });

  it("still returns future work", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    expect(listedIds(res.body).has(futureProjectId)).toBe(true);
  });

  it("shows a project once when it has werkbonnen on several dates", async () => {
    // The split project holds a past-dated werkbon AND one planned today. In one
    // list it appears exactly once — no duplicate row, and never dropped.
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    const ids = (res.body.projects as { id: string }[]).map((p) => p.id);
    expect(ids.filter((id) => id === splitProjectId)).toHaveLength(1);
  });

  it("surfaces an assigned werkbon that has no planned date", async () => {
    // Undated work is included on purpose: it is assigned, it just was never
    // scheduled. A date-based filter rejecting null would strand it on no screen.
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    expect(listedIds(res.body).has(undatedProjectId)).toBe(true);
  });

  it("orders the list earliest-planned first, undated last", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    const dates = (res.body.projects as { plannedDate: string | null }[]).map(
      (p) => p.plannedDate,
    );
    const dated = dates.filter((d): d is string => d !== null);
    expect([...dated].sort()).toEqual(dated);
    // Every undated row sits after every dated one.
    const firstNull = dates.indexOf(null);
    if (firstNull !== -1) expect(dates.slice(firstNull).every((d) => d === null)).toBe(true);
  });

  it("links a row to its werkbon so the card can be opened", async () => {
    // Field staff cannot reach /projects/:id, so the row carries the werkbon id.
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    const row = (res.body.projects as { id: string; workOrderId: string | null }[]).find(
      (p) => p.id === overdueProjectId,
    );
    expect(row?.workOrderId).toBe(werkbonOverdueId);
  });

  it("drops a past-dated werkbon once it is ready for review", async () => {
    await prisma.workOrder.update({
      where: { id: werkbonOverdueId },
      data: { listStatus: "ready_for_review" },
    });
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    expect(listedIds(res.body).has(overdueProjectId)).toBe(false);

    // Restore for any later test in this file.
    await prisma.workOrder.update({
      where: { id: werkbonOverdueId },
      data: { listStatus: "open" },
    });
  });
});

// --- FIX 7 ---------------------------------------------------------------
// The notifications feed matched `tasks.some.assigneeId` only, dropping the
// werkbon-level arm — so a monteur assigned to the visit got nothing.
describe("technician notifications", () => {
  it("receives newWorkOrder items for werkbon-level assignments", async () => {
    const res = await request(app).get("/api/notifications").set(auth(techToken));
    expect(res.status).toBe(200);

    const newWoIds = new Set(
      (res.body.items as { id: string; category: string }[])
        .filter((i) => i.category === "newWorkOrder")
        .map((i) => i.id),
    );
    expect(newWoIds.has(`newwo:${werkbonOverdueId}`)).toBe(true);
    expect(newWoIds.has(`newwo:${werkbonFutureId}`)).toBe(true);
  });

  it("does not notify about a werkbon assigned to someone else", async () => {
    const otherEmp = await prisma.employee.create({
      data: { orgId, name: `${TAG} Other`, phone: "0600000001", role: "Technician" },
    });
    const strangerProj = await prisma.project.findFirst({ where: { id: futureProjectId } });
    const foreign = await prisma.workOrder.create({
      data: {
        projectId: strangerProj!.id,
        title: `${TAG} foreign`,
        assignees: { connect: { id: otherEmp.id } },
      },
    });

    const res = await request(app).get("/api/notifications").set(auth(techToken));
    const ids = new Set((res.body.items as { id: string }[]).map((i) => i.id));
    expect(ids.has(`newwo:${foreign.id}`)).toBe(false);
  });
});
