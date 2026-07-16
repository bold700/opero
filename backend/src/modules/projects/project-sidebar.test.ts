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

  empA = (await prisma.employee.create({
    data: { orgId, name: `${TAG}-empA`, phone: "0", roles: ["Technician"], status: "active" },
  })).id;
  empB = (await prisma.employee.create({
    data: { orgId, name: `${TAG}-empB`, phone: "0", roles: ["Technician"], status: "active" },
  })).id;
  workTypeId = (await prisma.workType.create({ data: { orgId, name: `${TAG}-wt` } })).id;

  projectId = (await prisma.project.findFirstOrThrow({ where: { orgId, deletedAt: null } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.workType.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("project sidebar PATCH", () => {
  it("sets urgency, project leader and multiple installers", async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ urgency: "urgent", projectLeaderId: empA, installerIds: [empA, empB] });
    expect(res.status).toBe(200);
    expect(res.body.urgency).toBe("urgent");
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

  it("rejects an installer from another org (400)", async () => {
    const otherEmp = await prisma.employee.create({
      data: { orgId: otherOrgId, name: `${TAG}-otherEmp`, phone: "0", roles: ["Technician"], status: "active" },
    });
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(adminToken))
      .send({ installerIds: [otherEmp.id] });
    expect(res.status).toBe(400);
  });
});
