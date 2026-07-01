import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../index.js";
import { prisma } from "../db/client.js";
import { hashPassword } from "./service.js";

// Change-password: verify current, reject bad/duplicate, on success revoke all
// sessions but re-issue the current one (caller stays logged in). Throwaway user
// so no seeded demo password is ever changed.

const email = "changepwtest@opero.test";
const OLD = "old-password-abc";
const NEW = "new-password-xyz";

async function login(password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("seed org required");
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await hashPassword(OLD) },
    create: { email, name: "ChangePW Test", passwordHash: await hashPassword(OLD), role: "admin", orgId: org.id },
  });
});

afterAll(async () => {
  const u = await prisma.user.findUnique({ where: { email } });
  if (u) await prisma.authSession.deleteMany({ where: { userId: u.id } });
  await prisma.user.deleteMany({ where: { email } });
});

describe("POST /auth/change-password", () => {
  it("rejects a wrong current password (401)", async () => {
    const { body } = await login(OLD);
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("authorization", `Bearer ${body.accessToken}`)
      .send({ currentPassword: "nope", newPassword: NEW, refreshToken: body.refreshToken });
    expect(res.status).toBe(401);
  });

  it("rejects a new password equal to the current (400)", async () => {
    const { body } = await login(OLD);
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("authorization", `Bearer ${body.accessToken}`)
      .send({ currentPassword: OLD, newPassword: OLD, refreshToken: body.refreshToken });
    expect(res.status).toBe(400);
  });

  it("changes the password, revokes old sessions, keeps the current one", async () => {
    const first = await login(OLD);
    const oldRefresh = first.body.refreshToken;

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("authorization", `Bearer ${first.body.accessToken}`)
      .send({ currentPassword: OLD, newPassword: NEW, refreshToken: oldRefresh });
    expect(change.status).toBe(200);
    expect(change.body.accessToken).toBeTruthy();
    expect(change.body.refreshToken).toBeTruthy();

    // Old refresh token is now revoked.
    const oldRefreshRes = await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefresh });
    expect(oldRefreshRes.status).toBe(401);

    // The re-issued session works.
    const meRes = await request(app).get("/api/auth/me").set("authorization", `Bearer ${change.body.accessToken}`);
    expect(meRes.status).toBe(200);

    // Login with the new password works; old fails.
    const withNew = await login(NEW);
    expect(withNew.body.accessToken).toBeTruthy();
    const withOld = await login(OLD);
    expect(withOld.body.accessToken).toBeUndefined();
  });
});
