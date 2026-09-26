// Integration: real photo upload + pre-job dispatch gate, against the LOCAL
// disk storage adapter (no cloud creds needed). We blank the STORAGE_* env
// BEFORE importing the app so the storage singleton resolves to local disk.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Force the local-disk adapter for this test file.
vi.stubEnv("STORAGE_BUCKET", "");
vi.stubEnv("STORAGE_ENDPOINT", "");
vi.stubEnv("STORAGE_ACCESS_KEY", "");
vi.stubEnv("STORAGE_SECRET_KEY", "");

const { default: request } = await import("supertest");
const sharp = (await import("sharp")).default;
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");

const TAG = "phototest";
const adminEmail = `${TAG}-admin@opero.test`;
let adminToken: string;
let orgId: string;
let workOrderId: string;
let taskId: string;
let projectId: string;

async function login(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "pw-photo-123" });
  return res.body.accessToken;
}

beforeAll(async () => {
  // Own org + prejob template — a bare findFirst() picked an arbitrary org
  // (suites create orgs concurrently), sometimes one without a template.
  const org = await prisma.organization.create({ data: { name: `${TAG} Org` } });
  orgId = org.id;
  await prisma.prejobCheckItem.createMany({
    data: [
      { orgId, key: "address_confirmed", label: "Adres en toegang bevestigd", ordinal: 0 },
      { orgId, key: "materials_ready", label: "Benodigde materialen gereed", ordinal: 1 },
    ],
  });
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Photo Admin",
      passwordHash: await hashPassword("pw-photo-123"),
      role: "admin",
      orgId,
    },
  });
  adminToken = await login(adminEmail);

  // A throwaway project + work order + task to attach photos to.
  // Own customer + project — suites must never borrow seeded data.
  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const project = await prisma.project.create({
    data: { orgId, customerId: customer.id, customerName: customer.name, name: `${TAG} Project`, projectNumber: `${TAG}-P1`, insulationType: "", nextStepKey: "sendQuote", address: "", postalCode: "", city: "" },
  });
  projectId = project.id;
  const wo = await request(app)
    .post("/api/work-orders")
    .set("authorization", `Bearer ${adminToken}`)
    .send({ projectId, title: "photo-test WO" });
  workOrderId = wo.body.id;
  const withTask = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set("authorization", `Bearer ${adminToken}`)
    .send({});
  taskId = withTask.body.tasks[0].id;
});

afterAll(async () => {
  await prisma.workOrderTask.deleteMany({ where: { workOrderId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.prejobCheckItem.deleteMany({ where: { org: { name: { startsWith: TAG } } } });
  await prisma.auditLog.deleteMany({ where: { org: { name: { startsWith: TAG } } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: TAG } } });
});

async function pngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 10, g: 200, b: 90 } },
  })
    .png()
    .toBuffer();
}

describe("task photo upload", () => {
  it("uploads, returns a {key,url} ref, then deletes", async () => {
    const buf = await pngBuffer();
    const up = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/photos/before`)
      .set("authorization", `Bearer ${adminToken}`)
      .attach("file", buf, "before.png");
    expect(up.status).toBe(201);
    const task = up.body.tasks.find((t: { id: string }) => t.id === taskId);
    expect(task.beforePhotos).toHaveLength(1);
    const ref = task.beforePhotos[0];
    expect(typeof ref.key).toBe("string");
    expect(ref.url).toContain("/uploads/");
    // Key is org-scoped.
    expect(ref.key.startsWith(`${orgId}/`)).toBe(true);

    const del = await request(app)
      .delete(`/api/work-orders/${workOrderId}/tasks/${taskId}/photos`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({ photo: ref.key });
    expect(del.status).toBe(200);
    const task2 = del.body.tasks.find((t: { id: string }) => t.id === taskId);
    expect(task2.beforePhotos).toHaveLength(0);
  });

  // Regression: a result photo must land in resultPhotos and NOWHERE else.
  // Reported symptom was a photo added to "resultaten" showing up under
  // "vooraf"; this pins the two sets apart so a regression can't pass silently.
  it("keeps result photos out of the before set", async () => {
    const buf = await pngBuffer();
    const up = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/photos/result`)
      .set("authorization", `Bearer ${adminToken}`)
      .attach("file", buf, "result.png");
    expect(up.status).toBe(201);

    const task = up.body.tasks.find((t: { id: string }) => t.id === taskId);
    expect(task.resultPhotos).toHaveLength(1);
    expect(task.beforePhotos).toHaveLength(0);

    // ...and the reverse: a before photo doesn't leak into the result set.
    const up2 = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/photos/before`)
      .set("authorization", `Bearer ${adminToken}`)
      .attach("file", buf, "before.png");
    expect(up2.status).toBe(201);

    const task2 = up2.body.tasks.find((t: { id: string }) => t.id === taskId);
    expect(task2.beforePhotos).toHaveLength(1);
    expect(task2.resultPhotos).toHaveLength(1);
    expect(task2.beforePhotos[0].key).not.toBe(task2.resultPhotos[0].key);

    // Clean up both so later tests see a fresh task.
    for (const ref of [...task2.beforePhotos, ...task2.resultPhotos]) {
      await request(app)
        .delete(`/api/work-orders/${workOrderId}/tasks/${taskId}/photos`)
        .set("authorization", `Bearer ${adminToken}`)
        .send({ photo: ref.key });
    }
  });

  it("rejects a non-image upload (magic-byte check)", async () => {
    const notImage = Buffer.from("this is definitely not an image");
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/photos/before`)
      .set("authorization", `Bearer ${adminToken}`)
      .attach("file", notImage, "evil.jpg");
    expect(res.status).toBe(400);
  });
});

describe("pre-job dispatch gate", () => {
  it("blocks dispatch until the werkbon's checklist is complete AND (when required) a photo exists", async () => {
    const authAdmin = { authorization: `Bearer ${adminToken}` };

    // The werkbon snapshotted its own items from the org template at creation.
    const wo = (await request(app).get(`/api/work-orders/${workOrderId}`).set(authAdmin)).body as {
      prejobItems: { id: string; done: boolean }[];
    };
    expect(wo.prejobItems.length).toBeGreaterThan(0);

    // empty/incomplete → blocked
    let r = await request(app).post(`/api/work-orders/${workOrderId}/dispatch`).set(authAdmin).send({});
    expect(r.status).toBe(400);

    // Turn ON the per-werkbon photo requirement so this test exercises the photo
    // half of the gate (default is OFF).
    await request(app)
      .patch(`/api/work-orders/${workOrderId}`)
      .set(authAdmin)
      .send({ prejobPhotoRequired: true })
      .expect(200);

    // Complete the checklist by ticking THIS werkbon's own items.
    for (const item of wo.prejobItems) {
      await request(app)
        .patch(`/api/work-orders/${workOrderId}/prejob-items/${item.id}`)
        .set(authAdmin)
        .send({ done: true })
        .expect(200);
    }

    // Checklist complete but photo required and none attached → still blocked.
    r = await request(app).post(`/api/work-orders/${workOrderId}/dispatch`).set(authAdmin).send({});
    expect(r.status).toBe(400);

    // Add a pre-job photo → gate satisfied.
    const up = await request(app)
      .post(`/api/work-orders/${workOrderId}/prejob-photos`)
      .set(authAdmin)
      .attach("file", await pngBuffer(), "site.png");
    expect(up.status).toBe(201);
    expect(up.body.canDispatch).toBe(true);

    // Dispatch succeeds, then is locked.
    const ok = await request(app).post(`/api/work-orders/${workOrderId}/dispatch`).set(authAdmin).send({});
    expect(ok.status).toBe(200);
    expect(ok.body.dispatchedAt).toBeTruthy();

    const again = await request(app).post(`/api/work-orders/${workOrderId}/dispatch`).set(authAdmin).send({});
    expect(again.status).toBe(400);
  });
});
