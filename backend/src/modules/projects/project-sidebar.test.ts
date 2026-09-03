import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// PATCH /projects/:id — the werkbon-detail sidebar edits project-level fields:
// urgency, planned dates, project leader, installers (many), work type.

const TAG = "projsidebar-test";
let orgId: string;
let otherOrgId: string;
let adminToken: string;
let projectId: string;
let empA: string;
let empB: string;
let workTypeId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  orgId = org.id;
  const otherOrg = await prisma.organization.create({ data: { name: `${TAG}-other` } });
  otherOrgId = otherOrg.id;

  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  // empA fills the project-leader slot below, so it needs a supervisory title:
  // the write path now refuses an employee whose job title is ineligible.
  // Foreman is eligible for BOTH slots, so it also works as an installer.
  empA = (await prisma.employee.create({
    data: { orgId, name: `${TAG}-empA`, phone: "0", role: "Foreman", status: "active" },
  })).id;
  empB = (await prisma.employee.create({
    data: { orgId, name: `${TAG}-empB`, phone: "0", role: "Technician", status: "active" },
  })).id;
  workTypeId = (await prisma.workType.create({ data: { orgId, name: `${TAG}-wt` } })).id;

  // Own project — suites must never borrow (and mutate) seeded data.
  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.workType.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.auditLog.deleteMany({ where: { org: { name: { startsWith: TAG } } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("project sidebar PATCH", () => {
  it("sets project leader and multiple installers (urgency is per-werkbon now)", async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ projectLeaderId: empA, installerIds: [empA, empB] });
    expect(res.status).toBe(200);
    // Urgency is a rollup of the project's werkbonnen — none exist → normal.
    expect(res.body.urgency).toBe("normal");
    expect(res.body.projectLeaderId).toBe(empA);
    expect([...res.body.installerIds].sort()).toEqual([empA, empB].sort());
  });

  it("sets the work type and mirrors its name into insulationType", async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ workTypeId });
    expect(res.status).toBe(200);
    expect(res.body.workTypeId).toBe(workTypeId);
    expect(res.body.workTypeName).toBe(`${TAG}-wt`);
    expect(res.body.insulationType).toBe(`${TAG}-wt`);
  });

  it("clears installers with an empty array", async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ installerIds: [] });
    expect(res.status).toBe(200);
    expect(res.body.installerIds).toEqual([]);
  });

  it("rejects a project leader whose job title is not supervisory (400)", async () => {
    // empB is a Technician: the picker never offers them for this slot, so the
    // write path must refuse the id too.
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ projectLeaderId: empB });
    expect(res.status).toBe(400);
  });

  it("accepts an employee with no job title in either slot", async () => {
    // Job title is optional metadata. Narrowing the pickers must never leave an
    // org that never filled it in unable to assign anyone.
    const untitled = await prisma.employee.create({
      data: { orgId, name: `${TAG}-untitled`, phone: "0", status: "active" },
    });
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ projectLeaderId: untitled.id, installerIds: [untitled.id] });
    expect(res.status).toBe(200);
    expect(res.body.projectLeaderId).toBe(untitled.id);
  });

  it("rejects an installer from another org (400)", async () => {
    const otherEmp = await prisma.employee.create({
      data: { orgId: otherOrgId, name: `${TAG}-otherEmp`, phone: "0", role: "Technician", status: "active" },
    });
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ installerIds: [otherEmp.id] });
    expect(res.status).toBe(400);
  });
});

// POST /:id/team connected whatever ids it was handed — no org check at all, so
// an employee from ANOTHER TENANT could be attached to this project. It is the
// same validation as PATCH /:id now, and it is covered separately because it is
// a different route with its own schema.
describe("POST /projects/:id/team", () => {
  it("assigns an eligible team", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/team`)
      .set(auth(adminToken))
      .send({ projectLeaderId: empA, installerIds: [empB] });
    expect(res.status).toBe(200);
  });

  it("rejects a team member from another org (400)", async () => {
    const otherEmp = await prisma.employee.create({
      data: { orgId: otherOrgId, name: `${TAG}-otherTeam`, phone: "0", role: "Technician", status: "active" },
    });
    const res = await request(app)
      .post(`/api/projects/${projectId}/team`)
      .set(auth(adminToken))
      .send({ installerIds: [otherEmp.id] });
    expect(res.status).toBe(400);

    // And nothing was attached as a side effect of the rejected call.
    const after = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { installers: { select: { id: true } } },
    });
    expect(after.installers.map((i) => i.id)).not.toContain(otherEmp.id);
  });

  it("rejects a technician in the project-leader slot (400)", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/team`)
      .set(auth(adminToken))
      .send({ projectLeaderId: empB });
    expect(res.status).toBe(400);
  });
});

// The pickers narrow by job title through this endpoint, so what it returns is
// exactly what the UI offers — and what the write paths above will accept.
describe("GET /work-orders/assignable?role=", () => {
  const list = async (query: Record<string, string>) =>
    request(app).get("/api/work-orders/assignable").query(query).set(auth(adminToken));

  it("narrows to project-leader-eligible staff", async () => {
    const res = await list({ role: "project_leader" });
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((r) => r.id);
    // empA is a Foreman (supervisory), empB a Technician.
    expect(ids).toContain(empA);
    expect(ids).not.toContain(empB);
  });

  it("narrows to technician-eligible staff", async () => {
    const res = await list({ role: "technician" });
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(empB);
    // Foreman works alongside the crew, so is assignable as one too.
    expect(ids).toContain(empA);
  });

  it("treats an EMPTY role as no filter, not an error", async () => {
    // `?role=` is what a cleared picker sends. 400-ing on it would empty the
    // unfiltered list instead of widening it.
    const res = await list({ role: "" });
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(empA);
    expect(ids).toContain(empB);
  });

  it("rejects an unknown role value (400)", async () => {
    const res = await list({ role: "bogus" });
    expect(res.status).toBe(400);
  });
});
