import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// A technician must see ONLY the work orders they are assigned to — assignment
// is per WERKBON (WorkOrder.assignees), not per project. Being on a project's
// crew must not expose every sibling werkbon of that project.
//
// Setup: ONE project the technician is an installer on, with TWO work orders.
// The technician is assigned to werkbon A only. B must be invisible.
//
// Plus a SECOND project the technician is NOT on the crew of, holding a werkbon
// he IS assigned to. That is the normal shape under per-werkbon assignment (the
// office dispatches a monteur to a visit without touching the project crew), and
// it is the case the first fixture cannot express: being an installer there makes
// the project readable for a reason that has nothing to do with the werkbon.

const TAG = "wo-assigneescope";
let orgId: string;
let adminToken: string;
let techToken: string;
let foremanToken: string;
let techEmpId: string;
let projectId: string; // the ONE project, holding both werkbonnen
let workOrderAId: string; // technician IS an assignee
let workOrderBId: string; // technician is NOT an assignee (same project)
// Second project: technician assigned to the werkbon, NOT on the project crew.
let offCrewProjectId: string;
let offCrewWorkOrderId: string; // technician IS an assignee
let offCrewSiblingId: string; // technician is NOT an assignee (same project)
let strangerProjectId: string; // no werkbon of his, not on the crew

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
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const techEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Tech`, phone: "0600000000", roles: ["Technician"] },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-m@opero.test`, passwordHash: pw, name: "M", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });
  techEmpId = techEmp.id;

  const foremanEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Foreman`, phone: "0600000002", roles: ["Foreman"] },
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
  projectId = projRes.body.id;
  // The technician is on the project crew — the OLD (project-level) rule would
  // stop right here and show them everything below.
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { connect: { id: techEmp.id } } },
  });

  const woA = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderAId = woA.body.id;
  const woB = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderBId = woB.body.id;

  // Assign the technician to werkbon A ONLY.
  await prisma.workOrder.update({
    where: { id: workOrderAId },
    data: { assignees: { connect: { id: techEmp.id } }, plannedDate: "2030-08-01" },
  });
  await prisma.workOrder.update({
    where: { id: workOrderBId },
    data: { plannedDate: "2030-08-02" },
  });

  // One OPEN zone on each werkbon, so the dashboard's open-task count can tell
  // "mine" apart from "my colleague's on the same project".
  await prisma.workOrderTask.create({
    data: { workOrderId: workOrderAId, description: `${TAG} zone A`, done: false },
  });
  await prisma.workOrderTask.create({
    data: { workOrderId: workOrderBId, description: `${TAG} zone B`, done: false },
  });

  // --- Second project: assigned to the werkbon, NOT on the project crew ------
  const offCrew = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} OffCrew Project` });
  offCrewProjectId = offCrew.body.id;
  // Deliberately NO installers/teamLeader/projectLeader connect here.

  const offCrewWo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: offCrewProjectId });
  offCrewWorkOrderId = offCrewWo.body.id;
  await prisma.workOrder.update({
    where: { id: offCrewWorkOrderId },
    data: { assignees: { connect: { id: techEmpId } }, plannedDate: "2030-09-01" },
  });

  const offCrewSibling = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: offCrewProjectId });
  offCrewSiblingId = offCrewSibling.body.id;

  // A project he has no connection to at all — the negative control.
  const stranger = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Stranger Project` });
  strangerProjectId = stranger.body.id;
  await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: strangerProjectId });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("technician sees only their ASSIGNED work orders", () => {
  it("list contains the assigned werkbon but NOT the unassigned sibling", async () => {
    const res = await request(app).get("/api/work-orders").set(auth(techToken));
    expect(res.status).toBe(200);
    const ids = new Set((res.body.items as { id: string }[]).map((w) => w.id));
    expect(ids.has(workOrderAId)).toBe(true);
    expect(ids.has(workOrderBId)).toBe(false);
  });

  // The count is org-wide, so assert it equals the number of werkbonnen he is
  // actually assigned to rather than a literal — otherwise adding a fixture
  // elsewhere in this file breaks it for a reason that has nothing to do with
  // scoping. Both assigned werkbonnen count; neither sibling does.
  it("counts reflect only the assigned werkbonnen", async () => {
    const res = await request(app).get("/api/work-orders").set(auth(techToken));
    expect(res.body.counts.total).toBe(2);
    const ids = new Set((res.body.items as { id: string }[]).map((w) => w.id));
    expect(ids.has(workOrderAId)).toBe(true);
    expect(ids.has(offCrewWorkOrderId)).toBe(true);
    expect(ids.has(workOrderBId)).toBe(false);
    expect(ids.has(offCrewSiblingId)).toBe(false);
  });

  it("detail of the assigned werkbon is readable", async () => {
    const res = await request(app).get(`/api/work-orders/${workOrderAId}`).set(auth(techToken));
    expect(res.status).toBe(200);
  });

  it("detail of the UNASSIGNED sibling is 404", async () => {
    const res = await request(app).get(`/api/work-orders/${workOrderBId}`).set(auth(techToken));
    expect(res.status).toBe(404);
  });

  it("PDF of the UNASSIGNED sibling is 404", async () => {
    const res = await request(app).get(`/api/work-orders/${workOrderBId}/pdf`).set(auth(techToken));
    expect(res.status).toBe(404);
  });

  it("cannot register hours on the UNASSIGNED sibling", async () => {
    const task = await prisma.workOrderTask.create({
      data: { workOrderId: workOrderBId, description: `${TAG} zone B` },
    });
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderBId}/tasks/${task.id}/hours`)
      .set(auth(techToken))
      .send({ hours: 2 });
    expect([403, 404]).toContain(res.status);
  });

  // Global search is a separate query path from the list endpoint, and it
  // reaches work orders directly — so it needs the SAME werkbon-level scope.
  // Scoping it through the project (which is what it used to do) leaks every
  // sibling werkbon of a project the technician is merely crewed on.
  it("global search does NOT surface the unassigned sibling werkbon", async () => {
    const res = await request(app).get(`/api/search?q=${TAG}`).set(auth(techToken));
    expect(res.status).toBe(200);
    const ids = new Set((res.body.workOrders as { id: string }[]).map((w) => w.id));
    expect(ids.has(workOrderAId)).toBe(true);
    expect(ids.has(workOrderBId)).toBe(false);
  });

  // The dashboard aggregates over PROJECTS, and the technician legitimately
  // sees this project — but its per-project numbers are built from nested
  // werkbon reads, which must still be werkbon-scoped. Otherwise the count
  // silently folds in a colleague's werkbon on the same project.
  it("dashboard open-task count excludes the colleague's werkbon", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(techToken));
    expect(res.status).toBe(200);
    // Exactly ONE open zone is theirs (zone A); zone B belongs to werkbon B.
    expect(res.body.openTaskCount).toBe(1);
  });

  // The project detail screen lists the project's werkbonnen. The technician
  // may open this project (they're on its crew), but the nested list is a
  // werkbon read — it must not name a colleague's visit.
  it("project detail's werkbon list excludes the colleague's werkbon", async () => {
    const res = await request(app).get(`/api/projects/${projectId}`).set(auth(techToken));
    expect(res.status).toBe(200);
    const ids = new Set((res.body.workOrders as { id: string }[]).map((w) => w.id));
    expect(ids.has(workOrderAId)).toBe(true);
    expect(ids.has(workOrderBId)).toBe(false);
  });

  it("planning feed excludes the unassigned sibling werkbon", async () => {
    const res = await request(app)
      .get("/api/planning?from=2000-01-01&to=2100-01-01")
      .set(auth(techToken));
    expect(res.status).toBe(200);
    const flat = JSON.stringify(res.body);
    expect(flat.includes(workOrderBId)).toBe(false);
  });
});

// Regression: the werkbon detail screen loads the werkbon AND its parent project
// (WorkOrderDetail.tsx). Per-werkbon assignment made "assigned to the visit but
// not on the project crew" the normal shape, but project visibility still only
// matched the crew — so the werkbon returned 200, the project 404'd, and the page
// rendered the backend's raw "Project not found". Werkbon access must imply read
// access to the project holding it.
describe("technician assigned to a werkbon, NOT on the project crew", () => {
  it("can open the parent project (regression: 'Project not found')", async () => {
    const res = await request(app)
      .get(`/api/projects/${offCrewProjectId}`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
  });

  // Same gate (loadProjectForUser), so it broke identically — this is what the
  // activity panel and every post-mutation refresh hit.
  it("can read the parent project's activity feed", async () => {
    const res = await request(app)
      .get(`/api/projects/${offCrewProjectId}/activity`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
  });

  it("still opens the werkbon itself", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${offCrewWorkOrderId}`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
  });

  // Reaching the project must not hand him the project's other visits.
  it("the project's werkbon list shows only his own werkbon", async () => {
    const res = await request(app)
      .get(`/api/projects/${offCrewProjectId}`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
    const ids = new Set((res.body.workOrders as { id: string }[]).map((w) => w.id));
    expect(ids.has(offCrewWorkOrderId)).toBe(true);
    expect(ids.has(offCrewSiblingId)).toBe(false);
  });

  it("detail of the sibling werkbon on that project is still 404", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${offCrewSiblingId}`)
      .set(auth(techToken));
    expect(res.status).toBe(404);
  });

  // Field staff never see money — reaching the project must not change that.
  it("the project payload carries no prices", async () => {
    const res = await request(app)
      .get(`/api/projects/${offCrewProjectId}`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
    const flat = JSON.stringify(res.body);
    for (const key of ["unitPrice", "costPrice", "margin", "marginPct"]) {
      expect(flat.includes(key)).toBe(false);
    }
  });

  it("a project he holds no werkbon on and is not crewed on stays 404", async () => {
    const res = await request(app)
      .get(`/api/projects/${strangerProjectId}`)
      .set(auth(techToken));
    expect(res.status).toBe(404);
  });

  it("the project list still excludes that unrelated project", async () => {
    const res = await request(app).get("/api/projects").set(auth(techToken));
    expect(res.status).toBe(200);
    const ids = new Set((res.body.items as { id: string }[]).map((p) => p.id));
    expect(ids.has(offCrewProjectId)).toBe(true);
    expect(ids.has(strangerProjectId)).toBe(false);
  });
});

describe("org-wide roles are unaffected", () => {
  it("admin still sees both werkbonnen", async () => {
    const res = await request(app).get("/api/work-orders").set(auth(adminToken));
    const ids = new Set((res.body.items as { id: string }[]).map((w) => w.id));
    expect(ids.has(workOrderAId)).toBe(true);
    expect(ids.has(workOrderBId)).toBe(true);
  });

  it("foreman still sees both werkbonnen (org-wide visibility)", async () => {
    const res = await request(app).get("/api/work-orders").set(auth(foremanToken));
    const ids = new Set((res.body.items as { id: string }[]).map((w) => w.id));
    expect(ids.has(workOrderAId)).toBe(true);
    expect(ids.has(workOrderBId)).toBe(true);
  });
});
