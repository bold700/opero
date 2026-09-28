import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");
const { deriveWorkOrderStatus } = await import("./status.js");

// Signing off a work order must make it report "done" — the two regressions
// this covers both left a SIGNED work order looking unfinished in the list:
//   1. an urgent werkbon returned "urgent" before any completion check,
//      so such a work order could never reach "done" at all;
//   2. a work order with zero tasks stayed "open" (the tasks.length > 0 guard).
// Reopening must put it back on the derived (unsigned) value.

const TAG = "signed-status";
let orgId: string;
let adminToken: string;
let customerId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const signature = () =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png()
    .toBuffer();

// A fresh project (with the given urgency) + one work order on it.
async function makeWorkOrder(urgency: "normal" | "urgent"): Promise<string> {
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId, name: `${TAG} ${urgency} project` });
  const projectId = projRes.body.id as string;
  const woRes = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId });
  if (urgency !== "normal") {
    // Urgency is per-werkbon: set it on the visit itself.
    await request(app)
      .patch(`/api/work-orders/${woRes.body.id}`)
      .set(auth(adminToken))
      .send({ urgency });
  }
  return woRes.body.id as string;
}

async function finish(workOrderId: string) {
  return request(app)
    .post(`/api/work-orders/${workOrderId}/finish`)
    .set(auth(adminToken))
    .field("signedByName", "Klant")
    .attach("file", await signature(), "sig.png");
}

const listStatusOf = async (id: string) =>
  (await prisma.workOrder.findUnique({ where: { id }, select: { listStatus: true } }))?.listStatus;

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const customer = await prisma.customer.create({
    data: {
      orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl",
      phone: "", address: "", postalCode: "", city: "",
    },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

const lifecycleInput = (
  patch: Partial<Parameters<typeof deriveWorkOrderStatus>[0]> = {},
): Parameters<typeof deriveWorkOrderStatus>[0] => ({
  plannedDate: null,
  assigneeCount: 0,
  dispatchedAt: null,
  signedAt: null,
  approvedBySupervisor: false,
  invoiceStatus: "not_started",
  tasks: [],
  ...patch,
});

describe("deriveWorkOrderStatus ? sign-off transition (pure)", () => {
  it("signed work is ready for office review regardless of priority", () => {
    expect(
      deriveWorkOrderStatus(
        lifecycleInput({
          signedAt: new Date(),
          tasks: [{ done: true, startedAt: null }],
        }),
      ),
    ).toBe("ready_for_review");
  });

  it("signed wins with zero tasks", () => {
    expect(deriveWorkOrderStatus(lifecycleInput({ signedAt: new Date() }))).toBe(
      "ready_for_review",
    );
  });

  it("priority does not alter the lifecycle", () => {
    expect(
      deriveWorkOrderStatus(
        lifecycleInput({ tasks: [{ done: false, startedAt: null }] }),
      ),
    ).toBe("open");
  });

  it("unsigned, no tasks ? open", () => {
    expect(deriveWorkOrderStatus(lifecycleInput())).toBe("open");
  });
});

describe("signing a work order persists listStatus = ready_for_review", () => {
  it("an urgent work order keeps priority separate from lifecycle", async () => {
    const id = await makeWorkOrder("urgent");
    expect(await listStatusOf(id)).toBe("open");

    const res = await finish(id);
    expect(res.status).toBe(200);
    expect(await listStatusOf(id)).toBe("ready_for_review");

    const list = await request(app)
      .get(`/api/work-orders?status=ready_for_review&limit=50`)
      .set(auth(adminToken));
    expect((list.body.items as { id: string }[]).map((w) => w.id)).toContain(id);
  });

  it("work order with zero tasks becomes ready for review when signed", async () => {
    const id = await makeWorkOrder("normal");
    expect(await listStatusOf(id)).toBe("open");

    const res = await finish(id);
    expect(res.status).toBe(200);
    expect(await listStatusOf(id)).toBe("ready_for_review");
  });

  it("reopening keeps completed tasks ready for review", async () => {
    const id = await makeWorkOrder("urgent");
    await finish(id);
    expect(await listStatusOf(id)).toBe("ready_for_review");

    const res = await request(app)
      .post(`/api/work-orders/${id}/reopen`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(await listStatusOf(id)).toBe("open");
  });
});
