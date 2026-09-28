import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Cursor pagination + server-side counts + the denormalized listStatus sync for
// the work-orders list. Verifies:
//   - a page returns { items, nextCursor, counts } with items capped by ?limit;
//   - walking the cursor visits every row exactly once (no skips/repeats);
//   - counts reflect the WHOLE set, not just the page;
//   - ?status filters server-side;
//   - toggling a task's `done` flips the persisted listStatus (open → done),
//     proving recomputeWorkOrderStatus runs on the mutation path.

const TAG = "wo-pagination";
let orgId: string;
let adminToken: string;
let projectId: string;
const workOrderIds: string[] = [];

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

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

  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;

  // Five work orders on one project → enough to page with limit=2.
  for (let i = 0; i < 5; i++) {
    const res = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId });
    workOrderIds.push(res.body.id);
  }
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("work-orders pagination", () => {
  it("returns a bounded page with { items, nextCursor, counts }", async () => {
    const res = await request(app)
      .get(`/api/work-orders?projectId=${projectId}&limit=2`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(2);
    expect(typeof res.body.nextCursor).toBe("string");
    // Counts are whole-set totals, not the page size.
    expect(res.body.counts.total).toBe(5);
  });

  it("walking the cursor visits every row exactly once", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    // Page through with limit=2; stop when nextCursor is null.
    for (let guard = 0; guard < 10; guard++) {
      const url =
        `/api/work-orders?projectId=${projectId}&limit=2` +
        (cursor ? `&cursor=${cursor}` : "");
      const res = await request(app).get(url).set(auth(adminToken));
      expect(res.status).toBe(200);
      for (const w of res.body.items as { id: string }[]) seen.push(w.id);
      if (!res.body.nextCursor) break;
      cursor = res.body.nextCursor;
    }
    // Every created work order shows up exactly once — no skips, no repeats.
    const unique = new Set(seen);
    expect(unique.size).toBe(seen.length);
    for (const id of workOrderIds) expect(unique.has(id)).toBe(true);
    expect(seen.length).toBe(5);
  });

  it("toggling a task's done flips the denormalized listStatus, and ?status filters on it", async () => {
    const targetId = workOrderIds[0];

    // Add one task, then toggle it done → status should derive to "ready_for_review".
    const addTask = await request(app)
      .post(`/api/work-orders/${targetId}/tasks`)
      .set(auth(adminToken))
      .send({});
    expect(addTask.status).toBe(201);
    const taskId = addTask.body.tasks[0].id as string;

    await request(app)
      .post(`/api/work-orders/${targetId}/tasks/${taskId}/toggle`)
      .set(auth(adminToken));

    // The persisted column is now "ready_for_review".
    const row = await prisma.workOrder.findUnique({
      where: { id: targetId },
      select: { listStatus: true },
    });
    expect(row?.listStatus).toBe("ready_for_review");

    // Server-side ?status=ready_for_review returns this work order; the untouched ones (open)
    // are excluded — proving the filter runs on the denormalized column.
    const doneList = await request(app)
      .get(`/api/work-orders?projectId=${projectId}&status=ready_for_review&limit=50`)
      .set(auth(adminToken));
    expect(doneList.status).toBe(200);
    const doneIds = (doneList.body.items as { id: string }[]).map((w) => w.id);
    expect(doneIds).toContain(targetId);
    expect(doneIds.length).toBe(1);
    // Counts still reflect the whole set: 1 ready for review, 4 open.
    expect(doneList.body.counts.ready_for_review).toBe(1);
    expect(doneList.body.counts.open).toBe(4);
  });
});
