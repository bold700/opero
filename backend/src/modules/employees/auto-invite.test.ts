import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// "When an employee is created, an account should automatically be created for
// them" (WOB Isolatie, 17-07-2026). Creating an Employee with an email address
// now provisions an invited User linked to that employee, instead of waiting
// for an admin to click Invite.
//
// The provisioning is BEST-EFFORT on purpose: the employee record is the thing
// being created, and it must survive a taken email address or a dead mail
// provider. These tests pin both halves — the happy path, and that a failure
// still leaves the employee saved.

const TAG = "auto-invite-test";
let orgId: string;
let adminToken: string;
let technicianToken: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const createEmployee = (token: string, body: Record<string, unknown>) =>
  request(app).post("/api/employees").set(auth(token)).send(body);

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-admin@opero.test`,
      passwordHash: pw,
      name: "Admin",
      role: "admin",
      status: "active",
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const tech = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-tech@opero.test`,
      passwordHash: pw,
      name: "Tech",
      role: "technician",
      status: "active",
    },
  });
  technicianToken = signAccessToken({ sub: tech.id, role: "technician", orgId });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("employee create → automatic login provisioning", () => {
  it("creates an invited, employee-linked technician login", async () => {
    const email = `${TAG}-new@opero.test`;
    const res = await createEmployee(adminToken, {
      name: `${TAG} Nieuwe Monteur`,
      phone: "0612345678",
      email,
      roles: ["Technician"],
    });
    expect(res.status).toBe(201);
    expect(res.body.invite).toEqual({ invited: true, userId: expect.any(String) });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.status).toBe("invited");
    expect(user!.role).toBe("technician");
    // Linked back to the employee — this is what scopes their work orders.
    expect(user!.employeeId).toBe(res.body.id);
    expect(user!.orgId).toBe(orgId);
  });

  // TeamRole is a job description, not an access level. An office job title
  // must never mint an admin login by itself.
  it("never auto-grants admin, even for office roles", async () => {
    const email = `${TAG}-planner@opero.test`;
    const res = await createEmployee(adminToken, {
      name: `${TAG} Planner`,
      phone: "",
      email,
      roles: ["Planner", "Administration"],
    });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user!.role).toBe("technician");
  });

  it("skips provisioning when the employee has no email", async () => {
    const res = await createEmployee(adminToken, {
      name: `${TAG} Geen Email`,
      phone: "0611111111",
      roles: ["Technician"],
    });
    expect(res.status).toBe(201);
    expect(res.body.invite).toEqual({ invited: false, reason: "no_email" });
    // The employee still exists — no login is not an error.
    const emp = await prisma.employee.findUnique({ where: { id: res.body.id } });
    expect(emp).not.toBeNull();
  });

  it("still creates the employee when the email already has a login", async () => {
    const email = `${TAG}-dupe@opero.test`;
    const first = await createEmployee(adminToken, {
      name: `${TAG} Eerste`,
      phone: "",
      email,
      roles: ["Technician"],
    });
    expect(first.body.invite.invited).toBe(true);

    const second = await createEmployee(adminToken, {
      name: `${TAG} Tweede`,
      phone: "",
      email,
      roles: ["Technician"],
    });
    // Employee saved; invite reported as skipped rather than blowing up.
    expect(second.status).toBe(201);
    expect(second.body.invite).toEqual({ invited: false, reason: "email_taken" });
    const emp = await prisma.employee.findUnique({ where: { id: second.body.id } });
    expect(emp).not.toBeNull();
    // And the existing login was NOT repointed at the new employee.
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user!.employeeId).toBe(first.body.id);
  });

  it("is admin-only — a technician cannot create employees", async () => {
    const res = await createEmployee(technicianToken, {
      name: `${TAG} Verboden`,
      phone: "",
      email: `${TAG}-forbidden@opero.test`,
    });
    expect(res.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { email: `${TAG}-forbidden@opero.test` } })).toBeNull();
  });
});
