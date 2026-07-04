import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Capture the confirmation link (and its token) instead of sending mail.
const emailMock = vi.hoisted(() => ({ send: vi.fn(async () => {}) }));
vi.mock("../lib/email.js", () => ({ sendEmail: emailMock.send }));

const { default: request } = await import("supertest");
const { app } = await import("../index.js");
const { prisma } = await import("../db/client.js");
const { hashPassword } = await import("./service.js");

// Verified email-change flow:
//   request (re-auth w/ password) → confirmation link to NEW addr → confirm →
//   login email switches, sessions revoked. Plus wrong-password, taken-email,
//   reused/expired token, and that PATCH /profile no longer changes email.

const TAG = "emailchangetest";
const PW = "pw-emailchange-123";
const startEmail = `${TAG}-user@opero.test`;
const newEmail = `${TAG}-new@opero.test`;
let orgId: string;
let userId: string;
let token: string; // access token for the logged-in user

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function login(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

function lastEmailToken(): string {
  const calls = emailMock.send.mock.calls as unknown as Array<[{ text: string }]>;
  const last = calls[calls.length - 1]?.[0];
  const m = last?.text.match(/token=([a-f0-9]+)/i);
  if (!m) throw new Error("no token in email");
  return m[1];
}

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  const user = await prisma.user.create({
    data: { orgId, email: startEmail, passwordHash: await hashPassword(PW), name: "EC", role: "admin", status: "active" },
  });
  userId = user.id;
  token = (await login(startEmail, PW)).body.accessToken;
});

afterAll(async () => {
  await prisma.emailChange.deleteMany({ where: { user: { email: { startsWith: TAG } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("verified email change", () => {
  it("PATCH /profile no longer changes the login email", async () => {
    const res = await request(app)
      .patch("/api/auth/profile")
      .set(auth(token))
      .send({ name: "EC2", email: "hacker@evil.test", phone: "0600" });
    expect(res.status).toBe(200);
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.email).toBe(startEmail); // unchanged
    expect(u?.name).toBe("EC2"); // name still updates
  });

  it("rejects a request with the wrong current password", async () => {
    const res = await request(app)
      .post("/api/auth/email-change/request")
      .set(auth(token))
      .send({ newEmail, currentPassword: "wrong" });
    expect(res.status).toBe(401);
    const rows = await prisma.emailChange.count({ where: { userId } });
    expect(rows).toBe(0);
  });

  it("request with correct password: 204, email UNCHANGED, token issued", async () => {
    const res = await request(app)
      .post("/api/auth/email-change/request")
      .set(auth(token))
      .send({ newEmail, currentPassword: PW });
    expect(res.status).toBe(204);
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.email).toBe(startEmail); // not changed yet
    const rows = await prisma.emailChange.count({ where: { userId } });
    expect(rows).toBe(1);
  });

  it("confirm with the token: email switches, sessions revoked", async () => {
    const t = lastEmailToken();
    const res = await request(app).post("/api/auth/email-change/confirm").send({ token: t });
    expect(res.status).toBe(204);

    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.email).toBe(newEmail);
    // All sessions revoked → the old access token's refresh chain is dead.
    const live = await prisma.authSession.count({ where: { userId, revoked: false } });
    expect(live).toBe(0);

    // Old email no longer logs in; new email does.
    expect((await login(startEmail, PW)).status).toBe(401);
    const ok = await login(newEmail, PW);
    expect(ok.status).toBe(200);
    token = ok.body.accessToken; // refresh for later tests
  });

  it("a reused (already-consumed) token is rejected", async () => {
    const t = lastEmailToken(); // same token as the confirmed one
    const res = await request(app).post("/api/auth/email-change/confirm").send({ token: t });
    expect(res.status).toBe(400);
  });

  it("an invalid token is rejected", async () => {
    const res = await request(app)
      .post("/api/auth/email-change/confirm")
      .send({ token: "deadbeef" });
    expect(res.status).toBe(400);
  });

  it("an expired token is rejected", async () => {
    // Issue a change then backdate it past expiry.
    await request(app)
      .post("/api/auth/email-change/request")
      .set(auth(token))
      .send({ newEmail: `${TAG}-third@opero.test`, currentPassword: PW });
    const t = lastEmailToken();
    await prisma.emailChange.updateMany({
      where: { userId, used: false },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post("/api/auth/email-change/confirm").send({ token: t });
    expect(res.status).toBe(400);
  });

  it("does not switch to an address already taken by another user", async () => {
    // Another user owns `taken@`.
    const takenEmail = `${TAG}-taken@opero.test`;
    await prisma.user.create({
      data: { orgId, email: takenEmail, passwordHash: await hashPassword(PW), name: "T", role: "admin", status: "active" },
    });
    const before = emailMock.send.mock.calls.length;
    const res = await request(app)
      .post("/api/auth/email-change/request")
      .set(auth(token))
      .send({ newEmail: takenEmail, currentPassword: PW });
    // Non-enumeration: still 204, but no email sent and no token issued.
    expect(res.status).toBe(204);
    expect(emailMock.send.mock.calls.length).toBe(before);
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.email).toBe(newEmail); // unchanged
  });
});
