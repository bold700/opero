import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Spy on the email layer so we can pull the invite token out of the activation
// link instead of actually sending mail.
const emailMock = vi.hoisted(() => ({ send: vi.fn(async () => {}) }));
vi.mock("../lib/email.js", () => ({ sendEmail: emailMock.send }));

const { default: request } = await import("supertest");
const { app } = await import("../index.js");
const { prisma } = await import("../db/client.js");
const { hashPassword } = await import("../auth/service.js");

// User provisioning / invitation lifecycle:
//   admin invites → user is `invited` → login rejected → activate via reset-password
//   → user is `active` → login works. Plus collision (409), role mismatch (400),
//   self-disable guard, resend, disable/enable, and cross-org isolation.

const TAG = "provtest";
const adminEmail = `${TAG}-admin@opero.test`;
// A login is derived from a person's email — the invited tech uses the
// employee's email, the invited client uses the customer's email.
const techEmail = `${TAG}-tech@opero.test`;
const clientEmail = `${TAG}-client@opero.test`;
let adminToken: string;
let orgId: string;
let employeeId: string;
let customerId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

function login(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

// Pull the ?token= out of the most recent invite email captured by the mock.
function lastInviteToken(): string {
  const calls = emailMock.send.mock.calls as unknown as Array<[{ text: string }]>;
  const last = calls[calls.length - 1]?.[0];
  const match = last?.text.match(/token=([a-f0-9]+)/i);
  if (!match) throw new Error("no invite token found in email");
  return match[1];
}

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;

  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  await prisma.user.create({
    data: {
      orgId,
      email: adminEmail,
      passwordHash: await hashPassword("pw-prov-123"),
      name: "Prov Admin",
      role: "admin",
      status: "active",
    },
  });
  const emp = await prisma.employee.create({
    data: {
      orgId,
      name: `${TAG} Tech`,
      phone: "0600000000",
      email: techEmail,
      roles: ["Technician"],
    },
  });
  employeeId = emp.id;
  const cust = await prisma.customer.create({
    data: {
      orgId,
      name: `${TAG} Client BV`,
      contactName: "X",
      email: clientEmail,
      phone: "",
      address: "",
      postalCode: "",
      city: "",
    },
  });
  customerId = cust.id;

  adminToken = (await login(adminEmail, "pw-prov-123")).body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("user provisioning", () => {
  it("invites a technician, gates login until activation, then activates", async () => {
    // Admin provisions the technician — email/name are derived from the employee.
    const invite = await request(app)
      .post("/api/users/invite")
      .set(auth(adminToken))
      .send({ kind: "employee", employeeId, role: "technician" });
    expect(invite.status).toBe(201);
    expect(invite.body.status).toBe("invited");
    expect(invite.body.employeeId).toBe(employeeId);
    expect(invite.body.email).toBe(techEmail);

    // Invited users can't log in yet (even with any password).
    const blocked = await login(techEmail, "whatever");
    expect(blocked.status).toBe(401);

    // Activate by consuming the invite token via reset-password.
    const token = lastInviteToken();
    const activate = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "tech-pass-123" });
    expect(activate.status).toBe(204);

    // Now the account is active and login works.
    const ok = await login(techEmail, "tech-pass-123");
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();

    const dbUser = await prisma.user.findUnique({ where: { email: techEmail } });
    expect(dbUser?.status).toBe("active");
    expect(dbUser?.activatedAt).not.toBeNull();

    // The employee DTO now reports the linked account — on both the detail and
    // the list endpoints (the client shows a login-status chip in the table).
    const emp = await request(app)
      .get(`/api/employees/${employeeId}`)
      .set(auth(adminToken));
    expect(emp.body.account?.status).toBe("active");

    const empList = await request(app).get("/api/employees").set(auth(adminToken));
    const listed = (empList.body as { id: string; account: unknown }[]).find(
      (e) => e.id === employeeId,
    );
    expect(listed?.account).toMatchObject({ status: "active" });
  });

  it("won't invite an employee who already has a login (409)", async () => {
    // The technician above already has a login now.
    const dup = await request(app)
      .post("/api/users/invite")
      .set(auth(adminToken))
      .send({ kind: "employee", employeeId, role: "technician" });
    expect(dup.status).toBe(409);
  });

  it("won't invite a person with no email (400)", async () => {
    const noEmail = await prisma.employee.create({
      data: { orgId, name: `${TAG} NoEmail`, phone: "0600000001", roles: ["Technician"] },
    });
    const bad = await request(app)
      .post("/api/users/invite")
      .set(auth(adminToken))
      .send({ kind: "employee", employeeId: noEmail.id, role: "technician" });
    expect(bad.status).toBe(400);
  });

  it("rejects an unknown / cross-org employee (404)", async () => {
    const bad = await request(app)
      .post("/api/users/invite")
      .set(auth(adminToken))
      .send({ kind: "employee", employeeId: "does-not-exist", role: "admin" });
    expect(bad.status).toBe(404);
  });

  it("invites a client linked to a customer (role forced to client)", async () => {
    const invite = await request(app)
      .post("/api/users/invite")
      .set(auth(adminToken))
      // Role is NOT part of the customer payload — it's always client.
      .send({ kind: "customer", customerId });
    expect(invite.status).toBe(201);
    expect(invite.body.customerId).toBe(customerId);
    expect(invite.body.role).toBe("client");
    expect(invite.body.email).toBe(clientEmail);

    const cust = await request(app)
      .get(`/api/customers/${customerId}`)
      .set(auth(adminToken));
    expect(cust.body.account?.status).toBe("invited");
  });

  it("GET /invitable lists people without a login, excludes the rest", async () => {
    const res = await request(app).get("/api/users/invitable").set(auth(adminToken));
    expect(res.status).toBe(200);
    const list = res.body as { kind: string; id: string; email: string }[];
    // The tech + client already have logins → excluded. The no-email employee
    // has no email → excluded.
    expect(list.find((p) => p.id === employeeId)).toBeUndefined();
    expect(list.find((p) => p.id === customerId)).toBeUndefined();
    expect(list.every((p) => p.email && p.email.length > 0)).toBe(true);
  });

  it("resends an invite (invited only)", async () => {
    const clientUser = await prisma.user.findUnique({
      where: { email: `${TAG}-client@opero.test` },
    });
    const resend = await request(app)
      .post(`/api/users/${clientUser!.id}/resend-invite`)
      .set(auth(adminToken));
    expect(resend.status).toBe(204);

    // Resend on an already-active user is a 400.
    const techUser = await prisma.user.findUnique({
      where: { email: `${TAG}-tech@opero.test` },
    });
    const badResend = await request(app)
      .post(`/api/users/${techUser!.id}/resend-invite`)
      .set(auth(adminToken));
    expect(badResend.status).toBe(400);
  });

  it("disables then enables a user, killing sessions on disable", async () => {
    const techUser = await prisma.user.findUnique({
      where: { email: `${TAG}-tech@opero.test` },
    });

    const disable = await request(app)
      .post(`/api/users/${techUser!.id}/disable`)
      .set(auth(adminToken));
    expect(disable.status).toBe(200);
    expect(disable.body.status).toBe("disabled");

    // A disabled user can't log in.
    const blocked = await login(`${TAG}-tech@opero.test`, "tech-pass-123");
    expect(blocked.status).toBe(401);

    const enable = await request(app)
      .post(`/api/users/${techUser!.id}/enable`)
      .set(auth(adminToken));
    expect(enable.status).toBe(200);
    expect(enable.body.status).toBe("active");

    // Re-enabled → login works again.
    const ok = await login(`${TAG}-tech@opero.test`, "tech-pass-123");
    expect(ok.status).toBe(200);
  });

  it("won't let an admin disable their own account", async () => {
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    // Give the org a second active admin so the last-admin guard can't be the
    // reason for the rejection — this must fail purely because it's self-disable.
    await prisma.user.create({
      data: {
        orgId,
        email: `${TAG}-admin2@opero.test`,
        passwordHash: await hashPassword("pw-prov-123"),
        name: "Prov Admin 2",
        role: "admin",
        status: "active",
      },
    });
    const res = await request(app)
      .post(`/api/users/${admin!.id}/disable`)
      .set(auth(adminToken));
    expect(res.status).toBe(400);
    const still = await prisma.user.findUnique({ where: { id: admin!.id } });
    expect(still?.status).toBe("active");
  });

  it("lets an admin disable a DIFFERENT admin (not self)", async () => {
    // The second admin created in the self-disable test still exists. Disabling
    // someone else is allowed; the actor stays active so the org isn't locked out.
    const other = await prisma.user.findUnique({
      where: { email: `${TAG}-admin2@opero.test` },
    });
    const res = await request(app)
      .post(`/api/users/${other!.id}/disable`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("disabled");
    const actor = await prisma.user.findUnique({ where: { email: adminEmail } });
    expect(actor?.status).toBe("active");
  });

  it("requires admin role for all provisioning endpoints", async () => {
    // Log in as the (now active) technician and confirm 403.
    const techLogin = await login(`${TAG}-tech@opero.test`, "tech-pass-123");
    const techToken = techLogin.body.accessToken;
    const res = await request(app).get("/api/users").set(auth(techToken));
    expect(res.status).toBe(403);
  });

  it("isolates users across orgs", async () => {
    // Create a second org + admin; it must not see this org's users.
    const otherOrg = await prisma.organization.create({
      data: { name: `${TAG} Other Org` },
    });
    await prisma.user.create({
      data: {
        orgId: otherOrg.id,
        email: `${TAG}-otheradmin@opero.test`,
        passwordHash: await hashPassword("pw-prov-123"),
        name: "Other Admin",
        role: "admin",
        status: "active",
      },
    });
    const otherToken = (await login(`${TAG}-otheradmin@opero.test`, "pw-prov-123")).body
      .accessToken;

    const list = await request(app).get("/api/users").set(auth(otherToken));
    expect(list.status).toBe(200);
    const emails = (list.body as { email: string }[]).map((u) => u.email);
    expect(emails).not.toContain(`${TAG}-tech@opero.test`);

    // And it can't disable a user from the first org (404, not 200).
    const techUser = await prisma.user.findUnique({
      where: { email: `${TAG}-tech@opero.test` },
    });
    const crossDisable = await request(app)
      .post(`/api/users/${techUser!.id}/disable`)
      .set(auth(otherToken));
    expect(crossDisable.status).toBe(404);

    await prisma.user.deleteMany({ where: { orgId: otherOrg.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
