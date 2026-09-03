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

describe("deriveWorkOrderStatus — sign-off precedence (pure)", () => {
  it("signed wins over an urgent werkbon", () => {
    expect(
      deriveWorkOrderStatus({
        urgency: "urgent",
        signedAt: new Date(),
        tasks: [{ done: true, startedAt: null }],
      }),
    ).toBe("done");
  });

  it("signed wins with zero tasks", () => {
    expect(deriveWorkOrderStatus({ urgency: "normal", signedAt: new Date(), tasks: [] })).toBe("done");
  });

  it("unsigned behaviour is unchanged: urgent werkbon still reports urgent", () => {
    expect(
      deriveWorkOrderStatus({ urgency: "urgent", signedAt: null, tasks: [{ done: false, startedAt: null }] }),
    ).toBe("urgent");
  });

  it("unsigned, no tasks → open", () => {
    expect(deriveWorkOrderStatus({ urgency: "normal", signedAt: null, tasks: [] })).toBe("open");
  });
});

describe("signing a work order persists listStatus = done", () => {
  it("REGRESSION 1: an URGENT work order becomes done when signed", async () => {
    const id = await makeWorkOrder("urgent");
    expect(await listStatusOf(id)).toBe("urgent");

    const res = await finish(id);
    expect(res.status).toBe(200);
    expect(await listStatusOf(id)).toBe("done");

    // And it now shows up under the done filter (the user-visible symptom).
    const list = await request(app)
      .get(`/api/work-orders?status=done&limit=50`)
      .set(auth(adminToken));
    expect((list.body.items as { id: string }[]).map((w) => w.id)).toContain(id);
  });

  it("REGRESSION 2: work order with ZERO tasks becomes done when signed", async () => {
    const id = await makeWorkOrder("normal");
    expect(await listStatusOf(id)).toBe("open");

    const res = await finish(id);
    expect(res.status).toBe(200);
    expect(await listStatusOf(id)).toBe("done");
  });

  it("reopening reverts to the derived (unsigned) status", async () => {
    const id = await makeWorkOrder("urgent");
    await finish(id);
    expect(await listStatusOf(id)).toBe("done");

    const res = await request(app)
      .post(`/api/work-orders/${id}/reopen`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    // Back to urgent: the project is still urgent and it is no longer signed.
    expect(await listStatusOf(id)).toBe("urgent");
  });
});
