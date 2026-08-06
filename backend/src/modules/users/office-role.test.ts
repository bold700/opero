import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// THE OFFICE BOUNDARY.
//
// `admin` is the OWNER; `office` is staff. Office gets the full operational
// app, INCLUDING inviting technicians and customers — what it must never touch
// is org configuration, and any account at or above its own level. That last
// rule covers employee DELETE too, since deleting cascades into revoking the
// linked login and would otherwise be the way around the account guards.
//
// The boundary is per-target (canActOnAccount), not a blanket router gate, so
// both halves need asserting: re-locking the router to admin-only would still
// satisfy every "CANNOT" test here. The "CAN" blocks are what catch that.

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
      role: "Office", status: "active",
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
      role: "Office", status: "active",
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
      orgId, name: `${TAG} Target`, phone: "", role: "Technician",
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

// Office manages logins, but only DOWNWARD. `someUserId` is the OWNER's login,
// so every action against it must 403 — the level rule, not a blanket router
// gate. That distinction is the whole point: a regression that re-locks the
// router would still pass these, so the "CAN invite" block below is what
// catches it.
describe("office CANNOT manage logins at or above its own level", () => {
  it("cannot invite an employee as admin (would mint an owner)", async () => {
    const res = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: targetEmployeeId, role: "admin" });
    expect(res.status).toBe(403);
  });

  it("cannot disable the owner's account", async () => {
    const res = await request(app)
      .post(`/api/users/${someUserId}/disable`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);
  });

  it("cannot enable the owner's account", async () => {
    const res = await request(app)
      .post(`/api/users/${someUserId}/enable`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);
  });

  it("cannot resend the owner's invite", async () => {
    const res = await request(app)
      .post(`/api/users/${someUserId}/resend-invite`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);
  });

  it("cannot disable another office user (a peer)", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Peer Login`, phone: "", email: `${TAG}-peerlogin@opero.test`,
        role: "Office", status: "active",
      },
    });
    const peer = await prisma.user.create({
      data: {
        orgId, email: `${TAG}-peerlogin@opero.test`, passwordHash: await hashPassword("x"),
        name: "Peer Login", role: "office", status: "active", employeeId: emp.id,
      },
    });

    const res = await request(app)
      .post(`/api/users/${peer.id}/disable`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);

    const after = await prisma.user.findUnique({ where: { id: peer.id } });
    expect(after!.status).toBe("active");
  });
});

describe("office CAN manage logins below its own level", () => {
  it("invites a technician", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Invitee`, phone: "", email: `${TAG}-invitee@opero.test`,
        role: "Technician", status: "active",
      },
    });

    const res = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: emp.id, role: "technician" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("technician");
    expect(res.body.status).toBe("invited");
  });

  // The reason this whole change exists: office could not give a client a
  // portal login, and the account panel was hidden with no explanation.
  it("invites a customer as a client login", async () => {
    const cust = await prisma.customer.create({
      data: {
        orgId, name: `${TAG} Klant Login`, contactName: "C",
        email: `${TAG}-klant@opero.test`, phone: "", address: "",
        postalCode: "", city: "",
      },
    });

    const res = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "customer", customerId: cust.id });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("client");

    await prisma.user.deleteMany({ where: { customerId: cust.id } });
    await prisma.customer.delete({ where: { id: cust.id } });
  });

  it("promotes a technician to office, but not to admin", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Promote`, phone: "", email: `${TAG}-promote@opero.test`,
        role: "Technician", status: "active",
      },
    });
    const invited = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: emp.id, role: "technician" });
    expect(invited.status).toBe(201);
    const id = invited.body.id;

    const up = await request(app)
      .patch(`/api/users/${id}`)
      .set(auth(officeToken))
      .send({ role: "office" });
    expect(up.status).toBe(200);
    expect(up.body.role).toBe("office");

    // Now a peer — office can no longer reach it at all.
    const again = await request(app)
      .patch(`/api/users/${id}`)
      .set(auth(officeToken))
      .send({ role: "technician" });
    expect(again.status).toBe(403);
  });

  it("cannot promote anyone to admin", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} NoAdmin`, phone: "", email: `${TAG}-noadmin@opero.test`,
        role: "Technician", status: "active",
      },
    });
    const invited = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: emp.id, role: "technician" });
    expect(invited.status).toBe(201);

    const res = await request(app)
      .patch(`/api/users/${invited.body.id}`)
      .set(auth(officeToken))
      .send({ role: "admin" });
    expect(res.status).toBe(403);

    const after = await prisma.user.findUnique({ where: { id: invited.body.id } });
    expect(after!.role).toBe("technician");
  });

  it("cannot change the owner's role", async () => {
    const res = await request(app)
      .patch(`/api/users/${someUserId}`)
      .set(auth(officeToken))
      .send({ role: "technician" });
    expect(res.status).toBe(403);
  });

  // The asymmetry: granting your OWN level is onboarding, not escalation, so
  // office may hire a peer — but offboarding one stays the owner's call, which
  // the "cannot disable another office user" test above pins.
  it("invites another office user (a peer) but cannot then revoke them", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} New Clerk`, phone: "", email: `${TAG}-newclerk@opero.test`,
        role: "Office", status: "active",
      },
    });

    const res = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: emp.id, role: "office" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("office");

    // Created it, still can't take it away.
    const revoke = await request(app)
      .post(`/api/users/${res.body.id}/disable`)
      .set(auth(officeToken));
    expect(revoke.status).toBe(403);
  });

  it("resends, disables and re-enables a technician's login", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Cycle`, phone: "", email: `${TAG}-cycle@opero.test`,
        role: "Technician", status: "active",
      },
    });
    const invited = await request(app)
      .post("/api/users/invite")
      .set(auth(officeToken))
      .send({ kind: "employee", employeeId: emp.id, role: "technician" });
    expect(invited.status).toBe(201);
    const id = invited.body.id;

    const resent = await request(app)
      .post(`/api/users/${id}/resend-invite`)
      .set(auth(officeToken));
    expect(resent.status).toBe(204);

    const disabled = await request(app)
      .post(`/api/users/${id}/disable`)
      .set(auth(officeToken));
    expect(disabled.status).toBe(200);
    expect(disabled.body.status).toBe("disabled");

    const enabled = await request(app)
      .post(`/api/users/${id}/enable`)
      .set(auth(officeToken));
    expect(enabled.status).toBe(200);
    expect(enabled.body.status).toBe("active");
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
        role: "Technician", status: "active",
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

  // Delete revokes the linked login, so it obeys the same level rule as the
  // account routes — otherwise it would be the way around them. A peer's
  // record is therefore off-limits, and the login must survive the attempt.
  it("cannot delete another office user (a peer)", async () => {
    const emp = await prisma.employee.create({
      data: {
        orgId, name: `${TAG} Peer`, phone: "", email: `${TAG}-peer@opero.test`,
        role: "Office", status: "active",
      },
    });
    const peer = await prisma.user.create({
      data: {
        orgId, email: `${TAG}-peer@opero.test`, passwordHash: await hashPassword("x"),
        name: "Peer", role: "office", status: "active", employeeId: emp.id,
      },
    });

    const res = await request(app)
      .delete(`/api/employees/${emp.id}`)
      .set(auth(officeToken));
    expect(res.status).toBe(403);

    const after = await prisma.user.findUnique({ where: { id: peer.id } });
    expect(after!.status).toBe("active");
  });

  it("creates and edits an employee record", async () => {
    const created = await request(app)
      .post("/api/employees")
      .set(auth(officeToken))
      .send({ name: `${TAG} Hired`, phone: "0600000000", role: "Technician" });
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
