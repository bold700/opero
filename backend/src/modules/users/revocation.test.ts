import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Revoking access has to actually revoke access. Two holes this pins shut:
//
// 1. Soft-deleting an Employee/Customer left the linked login ACTIVE. The
//    record vanished from every list (filtered by `deletedAt`), so the account
//    was invisible AND still valid — and with the Toegang screen gone there is
//    no other place it would have shown up.
// 2. Disabling a user revoked their AuthSession rows, but access tokens are
//    stateless JWTs (JWT_ACCESS_TTL, default 15m). The token they already held
//    kept working until it expired. requireAuth now re-checks user.status.

const TAG = "revocation-test";
let orgId: string;
let adminToken: string;
let adminEmployeeId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  // The acting admin needs their own employee record so the self-delete guard
  // has something to compare against.
  const adminEmployee = await prisma.employee.create({
    data: {
      orgId,
      name: `${TAG} Admin`,
      phone: "",
      email: `${TAG}-admin@opero.test`,
      role: "Office",
      status: "active",
    },
  });
  adminEmployeeId = adminEmployee.id;

  const admin = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-admin@opero.test`,
      passwordHash: pw,
      name: "Admin",
      role: "admin",
      status: "active",
      employeeId: adminEmployee.id,
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("soft-deleting a domain record revokes its login", () => {
  it("disables the linked login and kills its sessions", async () => {
    const employee = await prisma.employee.create({
      data: {
        orgId,
        name: `${TAG} Monteur`,
        phone: "",
        email: `${TAG}-monteur@opero.test`,
        role: "Technician",
        status: "active",
      },
    });
    const victim = await prisma.user.create({
      data: {
        orgId,
        email: `${TAG}-monteur@opero.test`,
        passwordHash: await hashPassword("x"),
        name: "Monteur",
        role: "technician",
        status: "active",
        employeeId: employee.id,
      },
    });
    await prisma.authSession.create({
      data: {
        userId: victim.id,
        tokenHash: `${TAG}-hash`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const res = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set(auth(adminToken));
    expect(res.status).toBe(204);

    const after = await prisma.user.findUnique({ where: { id: victim.id } });
    expect(after!.status).toBe("disabled");

    const sessions = await prisma.authSession.findMany({
      where: { userId: victim.id },
    });
    expect(sessions.every((s) => s.revoked)).toBe(true);
  });

  it("does the same for a customer's portal login", async () => {
    const customer = await prisma.customer.create({
      data: {
        orgId,
        name: `${TAG} Klant`,
        contactName: "Contact",
        email: `${TAG}-klant@opero.test`,
        phone: "",
        address: "",
        postalCode: "",
        city: "",
      },
    });
    const victim = await prisma.user.create({
      data: {
        orgId,
        email: `${TAG}-klant@opero.test`,
        passwordHash: await hashPassword("x"),
        name: "Klant",
        role: "client",
        status: "active",
        customerId: customer.id,
      },
    });

    const res = await request(app)
      .delete(`/api/customers/${customer.id}`)
      .set(auth(adminToken));
    expect(res.status).toBe(204);

    const after = await prisma.user.findUnique({ where: { id: victim.id } });
    expect(after!.status).toBe("disabled");
  });

  // The cascade would otherwise route around the guard in POST /users/:id/disable
  // that stops an admin revoking their own access (and locking the org out).
  it("refuses to delete your own employee record", async () => {
    const res = await request(app)
      .delete(`/api/employees/${adminEmployeeId}`)
      .set(auth(adminToken));
    expect(res.status).toBe(400);

    const stillThere = await prisma.employee.findUnique({
      where: { id: adminEmployeeId },
    });
    expect(stillThere!.deletedAt).toBeNull();
  });
});

describe("a disabled account cannot use a still-valid access token", () => {
  it("rejects the token it was holding before being disabled", async () => {
    const employee = await prisma.employee.create({
      data: {
        orgId,
        name: `${TAG} Ex`,
        phone: "",
        email: `${TAG}-ex@opero.test`,
        role: "Technician",
        status: "active",
      },
    });
    const user = await prisma.user.create({
      data: {
        orgId,
        email: `${TAG}-ex@opero.test`,
        passwordHash: await hashPassword("x"),
        name: "Ex",
        role: "technician",
        status: "active",
        employeeId: employee.id,
      },
    });
    // Issued while active, and still cryptographically valid afterwards — this
    // is exactly the 15-minute window that used to stay open.
    const token = signAccessToken({ sub: user.id, role: "technician", orgId });

    const before = await request(app).get("/api/auth/me").set(auth(token));
    expect(before.status).toBe(200);

    await request(app)
      .post(`/api/users/${user.id}/disable`)
      .set(auth(adminToken))
      .expect(200);

    const after = await request(app).get("/api/auth/me").set(auth(token));
    expect(after.status).toBe(401);
  });
});
