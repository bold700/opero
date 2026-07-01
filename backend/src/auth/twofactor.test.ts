import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { authenticator } from "otplib";
import { app } from "../index.js";
import { prisma } from "../db/client.js";
import { hashPassword } from "./service.js";

// Full 2FA lifecycle: setup → enable (with a real TOTP code) → login requires a
// code → complete login → disable. Uses a throwaway user so seeded demo logins
// are never given a 2FA requirement.

const email = "twofatest@opero.test";
const password = "twofa-test-pw";
let token: string;

async function loginRaw() {
  return request(app).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("seed org required");
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await hashPassword(password), totpEnabled: false, totpSecret: null, pendingTotpSecret: null },
    create: { email, name: "2FA Test", passwordHash: await hashPassword(password), role: "admin", orgId: org.id },
  });
  const res = await loginRaw();
  token = res.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
});

describe("2FA lifecycle", () => {
  it("sets up, enables (real code), and login then requires a code", async () => {
    const setup = await request(app).post("/api/auth/2fa/setup").set("authorization", `Bearer ${token}`);
    expect(setup.status).toBe(200);
    expect(typeof setup.body.secret).toBe("string");
    expect(setup.body.qrDataUrl).toMatch(/^data:image/);
    const secret: string = setup.body.secret;

    // Bad code rejected.
    const bad = await request(app)
      .post("/api/auth/2fa/enable")
      .set("authorization", `Bearer ${token}`)
      .send({ code: "000000" });
    expect(bad.status).toBe(400);

    // Real code enables.
    const enable = await request(app)
      .post("/api/auth/2fa/enable")
      .set("authorization", `Bearer ${token}`)
      .send({ code: authenticator.generate(secret) });
    expect(enable.status).toBe(204);

    const me = await request(app).get("/api/auth/me").set("authorization", `Bearer ${token}`);
    expect(me.body.user.totpEnabled).toBe(true);

    // Login now requires 2FA.
    const login = await loginRaw();
    expect(login.body.mfaRequired).toBe(true);
    expect(typeof login.body.mfaToken).toBe("string");

    // Complete the login with a fresh code.
    const done = await request(app)
      .post("/api/auth/login/2fa")
      .send({ mfaToken: login.body.mfaToken, code: authenticator.generate(secret) });
    expect(done.status).toBe(200);
    expect(done.body.accessToken).toBeTruthy();
    expect(done.body.user.email).toBe(email);
  });

  it("disables with the correct password, then login is plain again", async () => {
    // Wrong password rejected.
    const wrong = await request(app)
      .post("/api/auth/2fa/disable")
      .set("authorization", `Bearer ${token}`)
      .send({ password: "nope" });
    expect(wrong.status).toBe(401);

    const ok = await request(app)
      .post("/api/auth/2fa/disable")
      .set("authorization", `Bearer ${token}`)
      .send({ password });
    expect(ok.status).toBe(204);

    const login = await loginRaw();
    expect(login.body.mfaRequired).toBeUndefined();
    expect(login.body.accessToken).toBeTruthy();
  });
});
