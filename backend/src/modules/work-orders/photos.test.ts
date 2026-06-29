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
  const org = (await prisma.organization.findFirst()) ?? null;
  if (!org) throw new Error("seed org required");
  orgId = org.id;
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
  const project = await prisma.project.findFirstOrThrow({ where: { orgId } });
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
  await prisma.user.deleteMany({ where: { email: adminEmail } });
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
  it("blocks dispatch until checklist complete AND a photo exists", async () => {
    // empty → blocked
    let r = await request(app)
      .post(`/api/work-orders/${workOrderId}/dispatch`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({});
    expect(r.status).toBe(400);

    // complete checklist
    for (const key of [
      "address_confirmed",
      "materials_ready",
      "safety_reviewed",
      "customer_informed",
    ]) {
      await request(app)
        .patch(`/api/work-orders/${workOrderId}/prejob-check`)
        .set("authorization", `Bearer ${adminToken}`)
        .send({ key, done: true });
    }
    // still blocked: no photo
    r = await request(app)
      .post(`/api/work-orders/${workOrderId}/dispatch`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({});
    expect(r.status).toBe(400);

    // add a pre-job photo
    const up = await request(app)
      .post(`/api/work-orders/${workOrderId}/prejob-photos`)
      .set("authorization", `Bearer ${adminToken}`)
      .attach("file", await pngBuffer(), "site.png");
    expect(up.status).toBe(201);
    expect(up.body.canDispatch).toBe(true);

    // now dispatch succeeds, then is locked
    const ok = await request(app)
      .post(`/api/work-orders/${workOrderId}/dispatch`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({});
    expect(ok.status).toBe(200);
    expect(ok.body.dispatchedAt).toBeTruthy();

    const again = await request(app)
      .post(`/api/work-orders/${workOrderId}/dispatch`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({});
    expect(again.status).toBe(400);
  });
});
