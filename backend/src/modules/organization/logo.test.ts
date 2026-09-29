import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

const TAG = "org-logo-test";
let orgId: string;
let token: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: TAG } });
  orgId = org.id;
  const user = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}@opero.test`,
      passwordHash: await hashPassword("x"),
      name: "Admin",
      role: "admin",
      status: "active",
    },
  });
  token = signAccessToken({ sub: user.id, role: "admin", orgId });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("organization logo", () => {
  it("uploads, exposes and removes the document logo", async () => {
    const image = await sharp({
      create: { width: 80, height: 40, channels: 3, background: "#6750A4" },
    }).png().toBuffer();
    const uploaded = await request(app)
      .post("/api/organization/logo")
      .set({ Authorization: `Bearer ${token}` })
      .attach("file", image, "logo.png");

    expect(uploaded.status).toBe(200);
    expect(uploaded.body.logoUrl).toEqual(expect.any(String));
    expect(uploaded.body.logoUrl.length).toBeGreaterThan(0);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).logo).toBeTruthy();

    const removed = await request(app)
      .delete("/api/organization/logo")
      .set({ Authorization: `Bearer ${token}` });
    expect(removed.status).toBe(200);
    expect(removed.body.logoUrl).toBeUndefined();
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })).logo).toBeNull();
  });
});
