import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { authenticator } from "otplib";
import { app } from "../index.js";
import { prisma } from "../db/client.js";
import { hashPassword } from "./service.js";

// Unique email prefix so repeated runs don't collide and we can clean up.
const TAG = "authtest";
const adminEmail = `${TAG}-admin@opero.test`;
const technicianEmail = `${TAG}-technician@opero.test`;
const mfaEmail = `${TAG}-mfa@opero.test`;
const PASSWORD = "correct-horse-battery";

let orgId: string;

beforeAll(async () => {
  // Reuse an existing org (seed created one) or create a throwaway.
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;

  // Clean any leftovers from prior runs.
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });

  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { orgId, email: adminEmail, passwordHash, name: "Admin", role: "admin" },
      { orgId, email: technicianEmail, passwordHash, name: "Technician", role: "technician" },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("login + session lifecycle", () => {
  it("rejects bad credentials generically", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: adminEmail, password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("logs in, returns tokens + user, /me works, refresh rotates, logout revokes", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: adminEmail, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeTruthy();
    expect(login.body.user.email).toBe(adminEmail);
    expect(login.body.user.role).toBe("admin");
    expect(login.body.user.passwordHash).toBeUndefined();

    // /me with the access token
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(adminEmail);

    // refresh rotates: old token becomes invalid, new pair issued
    const oldRefresh = login.body.refreshToken;
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: oldRefresh });
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();
    expect(refresh.body.refreshToken).toBeTruthy();
    expect(refresh.body.refreshToken).not.toBe(oldRefresh);

    // reusing the consumed (old) refresh token must fail
    const reuse = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: oldRefresh });
    expect(reuse.status).toBe(401);

    // logout revokes the current refresh token
    const logout = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: refresh.body.refreshToken });
    expect(logout.status).toBe(204);

    const afterLogout = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refresh.body.refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("2FA enrollment + login", () => {
  it("sets up, enables, and then requires TOTP at login", async () => {
    // create a fresh user and log in (no 2FA yet)
    const passwordHash = await hashPassword(PASSWORD);
    await prisma.user.create({
      data: { orgId, email: mfaEmail, passwordHash, name: "Mfa", role: "admin" },
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: mfaEmail, password: PASSWORD });
    expect(login.status).toBe(200);
    const access = login.body.accessToken;

    // setup → get a secret
    const setup = await request(app)
      .post("/api/auth/2fa/setup")
      .set("Authorization", `Bearer ${access}`);
    expect(setup.status).toBe(200);
    const secret: string = setup.body.secret;
    expect(secret).toBeTruthy();
    expect(setup.body.qrDataUrl).toContain("data:image/png");

    // enable with a valid code
    const enable = await request(app)
      .post("/api/auth/2fa/enable")
      .set("Authorization", `Bearer ${access}`)
      .send({ code: authenticator.generate(secret) });
    expect(enable.status).toBe(204);

    // now login returns mfaRequired, not tokens
    const login2 = await request(app)
      .post("/api/auth/login")
      .send({ email: mfaEmail, password: PASSWORD });
    expect(login2.status).toBe(200);
    expect(login2.body.mfaRequired).toBe(true);
    expect(login2.body.mfaToken).toBeTruthy();
    expect(login2.body.accessToken).toBeUndefined();

    // wrong code rejected
    const bad = await request(app)
      .post("/api/auth/login/2fa")
      .send({ mfaToken: login2.body.mfaToken, code: "000000" });
    expect(bad.status).toBe(401);

    // correct code completes login
    const ok = await request(app)
      .post("/api/auth/login/2fa")
      .send({ mfaToken: login2.body.mfaToken, code: authenticator.generate(secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    expect(ok.body.user.totpEnabled).toBe(true);
  });
});

describe("password reset", () => {
  it("issues a reset token and changes the password", async () => {
    // forgot-password always 204
    const forgot = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: technicianEmail });
    expect(forgot.status).toBe(204);

    // unknown email also 204 (no enumeration)
    const forgotUnknown = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@opero.test" });
    expect(forgotUnknown.status).toBe(204);

    // grab the raw token from the DB (email is logged in dev; here we read it)
    // The stored value is a hash, so instead re-issue via the same internal path:
    // simplest is to read the most recent reset row is impossible (hash only).
    // So we drive the flow through the token we mint here by calling the service.
    const { issuePasswordReset } = await import("./tokens.js");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: technicianEmail } });
    const token = await issuePasswordReset(user.id);

    const newPassword = "brand-new-password-9";
    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword });
    expect(reset.status).toBe(204);

    // old password fails, new password works
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: technicianEmail, password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: technicianEmail, password: newPassword });
    expect(newLogin.status).toBe(200);

    // a used reset token cannot be reused
    const reuse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "yet-another-pw" });
    expect(reuse.status).toBe(400);
  });
});
