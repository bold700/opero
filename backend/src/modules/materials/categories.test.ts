import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Material category management: create (+ dedupe), rename (cascades to materials),
// delete (blocked while in use). Admin-only.

const TAG = "matcat-test";
let orgId: string;
let adminToken: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.material.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.materialCategory.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
});

afterAll(async () => {
  await prisma.material.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.materialCategory.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("material categories", () => {
  it("creates a category and rejects a case-insensitive duplicate", async () => {
    const name = `${TAG}-Insulation`;
    const created = await request(app)
      .post("/api/materials/categories")
      .set(auth(adminToken))
      .send({ name });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(name);

    // Same name, different casing → 409.
    const dup = await request(app)
      .post("/api/materials/categories")
      .set(auth(adminToken))
      .send({ name: name.toLowerCase() });
    expect(dup.status).toBe(409);
  });

  it("lists categories with a material-usage count", async () => {
    const catName = `${TAG}-Foil`;
    await request(app).post("/api/materials/categories").set(auth(adminToken)).send({ name: catName });
    // A material in that category.
    await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({ name: `${TAG}-m1`, unit: "m", category: catName });

    const list = await request(app).get("/api/materials/categories").set(auth(adminToken));
    expect(list.status).toBe(200);
    const row = (list.body as { name: string; count: number }[]).find((c) => c.name === catName);
    expect(row?.count).toBe(1);
  });

  it("renames a category and cascades to its materials", async () => {
    const oldName = `${TAG}-OldName`;
    const newName = `${TAG}-NewName`;
    const cat = await request(app)
      .post("/api/materials/categories")
      .set(auth(adminToken))
      .send({ name: oldName });
    const mat = await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({ name: `${TAG}-m2`, unit: "m", category: oldName });

    const renamed = await request(app)
      .patch(`/api/materials/categories/${cat.body.id}`)
      .set(auth(adminToken))
      .send({ name: newName });
    expect(renamed.status).toBe(200);

    // The material now carries the new category name.
    const updated = await prisma.material.findUnique({ where: { id: mat.body.id }, select: { category: true } });
    expect(updated?.category).toBe(newName);
  });

  it("blocks deleting a category that is in use (409)", async () => {
    const catName = `${TAG}-InUse`;
    const cat = await request(app)
      .post("/api/materials/categories")
      .set(auth(adminToken))
      .send({ name: catName });
    await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({ name: `${TAG}-m3`, unit: "m", category: catName });

    const del = await request(app)
      .delete(`/api/materials/categories/${cat.body.id}`)
      .set(auth(adminToken));
    expect(del.status).toBe(409);

    // Still exists.
    const still = await prisma.materialCategory.findUnique({ where: { id: cat.body.id } });
    expect(still).not.toBeNull();
  });

  it("deletes an unused category (204)", async () => {
    const cat = await request(app)
      .post("/api/materials/categories")
      .set(auth(adminToken))
      .send({ name: `${TAG}-Unused` });
    const del = await request(app)
      .delete(`/api/materials/categories/${cat.body.id}`)
      .set(auth(adminToken));
    expect(del.status).toBe(204);
    const gone = await prisma.materialCategory.findUnique({ where: { id: cat.body.id } });
    expect(gone).toBeNull();
  });

  it("rejects a material with a category not in the org's list (400)", async () => {
    const res = await request(app)
      .post("/api/materials")
      .set(auth(adminToken))
      .send({ name: `${TAG}-bad`, unit: "m", category: `${TAG}-NOPE-not-a-category` });
    expect(res.status).toBe(400);
  });
});
