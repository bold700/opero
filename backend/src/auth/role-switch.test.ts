import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../index.js");
const { prisma } = await import("../db/client.js");
const { hashPassword } = await import("./service.js");
const { signAccessToken } = await import("./tokens.js");

const TAG = "role-switch-test";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let token: string;
let adminToken: string;
let userId: string;
let adminId: string;

beforeAll(async () => {
  const org = await prisma.organization.findFirstOrThrow();
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `${TAG}@opero.test`,
      passwordHash: await hashPassword("x"),
      name: "Planner and technician",
      role: "office",
      roles: ["office", "technician"],
      status: "active",
    },
  });
  userId = user.id;
  token = signAccessToken({ sub: user.id, role: "office", orgId: org.id });
  const admin = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `${TAG}-admin@opero.test`,
      passwordHash: await hashPassword("x"),
      name: "Role manager",
      role: "admin",
      roles: ["admin"],
      status: "active",
    },
  });
  adminId = admin.id;
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId: org.id });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
  await prisma.$disconnect();
});

describe("active account role", () => {
  it("switches the active role and applies its server permissions", async () => {
    const switched = await request(app)
      .patch("/api/auth/active-role")
      .set(auth(token))
      .send({ role: "technician" });
    expect(switched.status).toBe(200);
    expect(switched.body.user.role).toBe("technician");
    expect(switched.body.user.roles).toEqual(["office", "technician"]);

    const denied = await request(app).get("/api/customers").set(auth(token));
    expect(denied.status).toBe(403);

    const restored = await request(app)
      .patch("/api/auth/active-role")
      .set(auth(token))
      .send({ role: "office" });
    expect(restored.status).toBe(200);
    expect(restored.body.user.role).toBe("office");
    expect((await request(app).get("/api/customers").set(auth(token))).status).toBe(200);
  });

  it("refuses a role that was not assigned", async () => {
    const response = await request(app)
      .patch("/api/auth/active-role")
      .set(auth(token))
      .send({ role: "foreman" });
    expect(response.status).toBe(403);
  });

  it("lets an administrator assign several roles to one account", async () => {
    const response = await request(app)
      .patch(`/api/users/${userId}`)
      .set(auth(adminToken))
      .send({ roles: ["office", "foreman", "technician"] });
    expect(response.status).toBe(200);
    expect(response.body.roles).toEqual(["office", "foreman", "technician"]);
    expect(response.body.role).toBe("office");
  });
});
