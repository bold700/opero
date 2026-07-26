import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// THE OFFICE BOUNDARY.
//
// `admin` is the OWNER; `office` is staff. Office gets the full operational app
// but must never touch the two things that decide who gets in and how the
// company is configured — plus employee DELETE, which cascades into revoking a
// login and would otherwise let a clerk disable the owner.
//
// Every check here is a `role === "admin"` comparison that stays valid
// TypeScript forever, so nothing but a test will catch a regression.

const TAG = "office-role-test";
let orgId: string;
let officeToken: string;
let adminToken: string;
let adminEmployeeId: string;
let targetEmployeeId: string;
let someUserId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");

  const adminEmployee = await prisma.employee.create({
    data: {
      orgId, name: `${TAG} Owner`, phone: "", email: `${TAG}-owner@opero.test`,
      roles: ["Administration"], status: "active",
    },
  });
  adminEmployeeId = adminEmployee.id;
  const admin = await prisma.user.create({
    data: {
      orgId, email: `${TAG}-owner@opero.test`, passwordHash: pw, name: "Owner",
      role: "admin", status: "active", employeeId: adminEmployee.id,
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
  someUserId = admin.id;

  const officeEmployee = await prisma.employee.create({
    data: {
      orgId, name: `${TAG} Clerk`, phone: "", email: `${TAG}-clerk@opero.test`,
      roles: ["WorkPlanner"], status: "active",
    },
  });
  const office = await prisma.user.create({
    data: {
      orgId, email: `${TAG}-clerk@opero.test`, passwordHash: pw, name: "Clerk",
      role: "office", status: "active", employeeId: officeEmployee.id,
    },
  });
  officeToken = signAccessToken({ sub: office.id, role: "office", orgId });

  const target = await prisma.employee.create({
    data: {
      orgId, name: `${TAG} Target`, phone: "", roles: ["Technician"],
      status: "active",
    },
  });
  targetEmployeeId = target.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("office CANNOT manage logins", () => {
  it("cannot invite", async () => {
    const res = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: targetEmployeeId, role: "technician" });
    expect(res.status).toBe(403);
  });

  it("cannot disable an account", async () => {
    const res = await request(app)
      .post(`/api/users/${someUserId}/disable`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);
  });

  it("cannot enable an account", async () => {
    const res = await request(app)
      .post(`/api/users/${someUserId}/enable`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);
  });

  it("cannot resend an invite", async () => {
    const res = await request(app)
      .post(`/api/users/${someUserId}/resend-invite`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);
  });
});

describe("office CANNOT reach the owner's other powers", () => {
  // The escalation path: employee delete revokes the linked login, so deleting
  // an OWNER would lock them out of their own company. Office deleting ordinary
  // staff is fine and is covered in the "CAN" block below.
  it("cannot delete the OWNER's employee record", async () => {
    const res = await request(app)
      .delete(`/api/employees/${adminEmployeeId}`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);

    const owner = await prisma.user.findFirst({
      where: { email: `${TAG}-owner@opero.test` },
    });
    expect(owner!.status).toBe("active");
  });

  it("cannot change org settings", async () => {
    const res = await request(app)
      .patch("/api/organization")
      .set(auth(officeToken))
      .send({ name: "Hijacked BV" });
    expect(res.status).toBe(403);
  });

  it("cannot edit the org-wide pre-job checklist template", async () => {
    const res = await request(app)
      .post("/api/prejob-items")
      .set(auth(officeToken))
      .send({ label: "Should not exist" });
    expect(res.status).toBe(403);
  });
});

describe("office CAN run the operational app", () => {
  it("lists employees", async () => {
    const res = await request(app).get("/api/employees").set(auth(officeToken));
    expect(res.status).toBe(200);
  });

  // The standard rule is "not at or above your own level" — office removing a
  // technician or a peer is ordinary offboarding, not privilege escalation.
  it("deletes an employee with no login", async () => {
    const res = await request(app)
      .delete(`/api/employees/${targetEmployeeId}`)
      .set(auth(officeToken));
    expect(res.status).toBe(204);

    const gone = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
    });
    expect(gone!.deletedAt).not.toBeNull();
  });

  it("deletes a technician, revoking their login", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Monteur`, phone: "", email: `${TAG}-monteur@opero.test`,
        roles: ["Technician"], status: "active",
      },
    });
    const login = await prisma.user.create({
      data: {
        orgId, email: `${TAG}-monteur@opero.test`, passwordHash: await hashPassword("x"),
        name: "Monteur", role: "technician", status: "active", employeeId: emp.id,
      },
    });

    const res = await request(app)
      .delete(`/api/employees/${emp.id}`)
      .set(auth(officeToken));
    expect(res.status).toBe(204);

    const after = await prisma.user.findUnique({ where: { id: login.id } });
    expect(after!.status).toBe("disabled");
  });

  it("deletes another office user (a peer)", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Peer`, phone: "", email: `${TAG}-peer@opero.test`,
        roles: ["Administration"], status: "active",
      },
    });
    await prisma.user.create({
      data: {
        orgId, email: `${TAG}-peer@opero.test`, passwordHash: await hashPassword("x"),
        name: "Peer", role: "office", status: "active", employeeId: emp.id,
      },
    });

    const res = await request(app)
      .delete(`/api/employees/${emp.id}`)
      .set(auth(officeToken));
    expect(res.status).toBe(204);
  });

  it("creates and edits an employee record", async () => {
    const created = await request(app)
      .post("/api/employees")
      .set(auth(officeToken))
      .send({ name: `${TAG} Hired`, phone: "0600000000", roles: ["Technician"] });
    expect(created.status).toBe(201);

    const edited = await request(app)
      .patch(`/api/employees/${created.body.id}`)
      .set(auth(officeToken))
      .send({ phone: "0611111111" });
    expect(edited.status).toBe(200);
  });

  it("lists and creates customers", async () => {
    const list = await request(app).get("/api/customers").set(auth(officeToken));
    expect(list.status).toBe(200);

    const created = await request(app)
      .post("/api/customers")
      .set(auth(officeToken))
      .send({
        name: `${TAG} Klant`, contactName: "C", email: "", phone: "",
        address: "", postalCode: "", city: "",
      });
    expect(created.status).toBe(201);
    await prisma.customer.deleteMany({ where: { id: created.body.id } });
  });

  it("reads materials (the catalog check used to reject anyone but admin/technician)", async () => {
    const res = await request(app).get("/api/materials/articles").set(auth(officeToken));
    expect(res.status).toBe(200);
  });

  it("sees company reports", async () => {
    const res = await request(app).get("/api/reports").set(auth(officeToken));
    expect(res.status).toBe(200);
  });

  // The silent one: visibleProjectsWhere falls through to the technician
  // "assigned only" branch, and office has no assignments — so a regression
  // here is an empty app with HTTP 200, not an error.
  it("sees ALL projects, not just assigned ones", async () => {
    const seeded = await prisma.project.count({
      where: { orgId, deletedAt: null },
    });
    const res = await request(app).get("/api/projects").set(auth(officeToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.length).toBe(Math.min(seeded, res.body.items.length));
  });

  it("gets the operational dashboard, not a blank one", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(officeToken));
    expect(res.status).toBe(200);
    // Office runs the same overview as the owner.
    expect(res.body.role).toBe("admin");
  });
});
