import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const emailMock = vi.hoisted(() => ({ send: vi.fn(async () => {}) }));
vi.mock("../lib/email.js", () => ({ sendEmail: emailMock.send }));

const { default: request } = await import("supertest");
const { app } = await import("../index.js");
const { prisma } = await import("../db/client.js");
const { hashPassword } = await import("./service.js");
const { issueInvite, issuePasswordReset } = await import("./tokens.js");

// Invites and password resets share one token table, and used to share one
// endpoint too: any valid token posted to /reset-password set a password, and
// activated the account as a side effect if it happened to be invited. That
// made the two interchangeable — an invitation could be redeemed as a reset,
// and a reset could activate an account nobody had accepted an invite for.
//
// They are now separate purposes, each consumed only by its own endpoint. These
// tests pin that boundary from both directions, and that a rejected token is
// left unspent rather than burned.

const TAG = "tokenpurpose";
let orgId: string;

const invitedEmail = `${TAG}-invited@opero.test`;
const activeEmail = `${TAG}-active@opero.test`;

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });

  await prisma.user.create({
    data: {
      orgId,
      email: invitedEmail,
      passwordHash: await hashPassword("unusable"),
      name: "Invited Person",
      role: "technician",
      status: "invited",
    },
  });
  await prisma.user.create({
    data: {
      orgId,
      email: activeEmail,
      passwordHash: await hashPassword("original-pass-123"),
      name: "Active Person",
      role: "technician",
      status: "active",
    },
  });
});

beforeEach(() => {
  emailMock.send.mockClear();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

const userIdFor = async (email: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

describe("invite and reset tokens are not interchangeable", () => {
  it("rejects an invite token at /reset-password, leaving it usable", async () => {
    const token = await issueInvite(await userIdFor(invitedEmail));

    const wrongDoor = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "attacker-chosen-123" });
    expect(wrongDoor.status).toBe(400);

    // The account was not activated by the rejected call...
    const stillInvited = await prisma.user.findUniqueOrThrow({
      where: { email: invitedEmail },
    });
    expect(stillInvited.status).toBe("invited");

    // ...and the invitation survives, so a misdirected click doesn't cost the
    // recipient their only link.
    const rightDoor = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token, newPassword: "chosen-by-owner-123" });
    expect(rightDoor.status).toBe(204);

    const activated = await prisma.user.findUniqueOrThrow({
      where: { email: invitedEmail },
    });
    expect(activated.status).toBe("active");
    expect(activated.activatedAt).not.toBeNull();
  });

  it("rejects a reset token at /accept-invite", async () => {
    const token = await issuePasswordReset(await userIdFor(activeEmail));

    const res = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token, newPassword: "should-not-apply-123" });
    expect(res.status).toBe(400);

    // The password is unchanged — the old one still logs in.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: activeEmail, password: "original-pass-123" });
    expect(login.status).toBe(200);
  });

  it("will not activate an already-active account through accept-invite", async () => {
    // An invite minted for someone who has since activated (or been re-invited
    // and accepted) must not re-run activation.
    const token = await issueInvite(await userIdFor(activeEmail));
    const res = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token, newPassword: "hijack-attempt-123" });
    expect(res.status).toBe(400);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: activeEmail, password: "original-pass-123" });
    expect(login.status).toBe(200);
  });

  it("burns a token once it is used for its own purpose", async () => {
    const token = await issuePasswordReset(await userIdFor(activeEmail));
    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "second-pass-123" });
    expect(first.status).toBe(204);

    const replay = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "third-pass-123" });
    expect(replay.status).toBe(400);

    // Restore the password so test ordering can't leak into the cases above.
    await prisma.user.update({
      where: { email: activeEmail },
      data: { passwordHash: await hashPassword("original-pass-123") },
    });
  });
});

describe("invite emails link to the invitation page", () => {
  it("sends an accept-invite URL, never a reset-password one", async () => {
    const { sendInviteEmail } = await import("../modules/users/provisioning.js");
    const token = await issueInvite(await userIdFor(invitedEmail));
    await sendInviteEmail(invitedEmail, "Invited Person", token, {
      orgId,
      invitedById: null,
    });

    const calls = emailMock.send.mock.calls as unknown as Array<
      [{ text: string; html?: string }]
    >;
    const sent = calls[calls.length - 1][0];
    expect(sent.text).toContain(`/accept-invite?token=${token}`);
    expect(sent.text).not.toContain("/reset-password");
    // The HTML part carries the same link — a mail whose only working call to
    // action is the button is broken wherever HTML is stripped, and vice versa.
    expect(sent.html).toContain(`/accept-invite?token=${token}`);
  });
});
