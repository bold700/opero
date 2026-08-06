import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Watch the email layer so "did anything get sent?" is an assertion rather than
// something we have to take on faith.
const emailMock = vi.hoisted(() => ({ send: vi.fn(async () => {}) }));
vi.mock("../../lib/email.js", () => ({ sendEmail: emailMock.send }));

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Creating an employee must NEVER provision a login or send mail.
//
// It used to do both the instant an email address was typed, so saving a record
// silently mailed an invitation to someone nobody had decided to give access to.
// Access is now granted only through POST /users/invite. These tests pin the
// absence of the old behaviour — the kind of thing that is easy to reintroduce
// as a convenience and expensive to notice, because the evidence lands in
// someone else's inbox rather than in a failing request.

const TAG = "no-auto-invite-test";
let orgId: string;
let adminToken: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const createEmployee = (token: string, body: Record<string, unknown>) =>
  request(app).post("/api/employees").set(auth(token)).send(body);

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });

  const admin = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-admin@opero.test`,
      passwordHash: await hashPassword("x"),
      name: "Admin",
      role: "admin",
      status: "active",
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
});

beforeEach(() => {
  emailMock.send.mockClear();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("employee create does not provision or notify", () => {
  it("creates no login and sends no email, even with an email address", async () => {
    const email = `${TAG}-new@opero.test`;
    const res = await createEmployee(adminToken, {
      name: `${TAG} Nieuwe Monteur`,
      phone: "0612345678",
      email,
      role: "Technician",
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    // The employee exists...
    expect(await prisma.employee.findUnique({ where: { id: res.body.id } })).not.toBeNull();
    // ...with no login behind it, and nothing sent.
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(emailMock.send).not.toHaveBeenCalled();
    // No invite outcome to report, because nothing was attempted.
    expect(res.body.invite).toBeUndefined();
  });

  it("reports no account on the employee it just created", async () => {
    const res = await createEmployee(adminToken, {
      name: `${TAG} Zonder Account`,
      phone: "",
      email: `${TAG}-none@opero.test`,
    });
    const detail = await request(app)
      .get(`/api/employees/${res.body.id}`)
      .set(auth(adminToken));
    expect(detail.status).toBe(200);
    expect(detail.body.account ?? null).toBeNull();
  });

  it("ignores an access level smuggled into the create payload", async () => {
    const email = `${TAG}-escalate@opero.test`;
    const res = await createEmployee(adminToken, {
      name: `${TAG} Escalatie`,
      phone: "",
      email,
      // A field the schema no longer knows about. It must not resurrect the old
      // path, and must not be a way to mint an admin login by request shape.
      accessRole: "admin",
    });
    expect(res.status).toBe(201);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(emailMock.send).not.toHaveBeenCalled();
  });

  it("still creates the employee when the email already belongs to a login", async () => {
    const email = `${TAG}-dupe@opero.test`;
    await prisma.user.create({
      data: {
        orgId,
        email,
        passwordHash: await hashPassword("x"),
        name: "Bestaand",
        role: "technician",
        status: "active",
      },
    });

    // Nothing here touches the users table, so a taken address is simply not
    // this route's problem any more.
    const res = await createEmployee(adminToken, {
      name: `${TAG} Dubbel`,
      phone: "",
      email,
    });
    expect(res.status).toBe(201);
    expect(emailMock.send).not.toHaveBeenCalled();
  });
});
