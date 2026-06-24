import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { prisma } from "../db/client.js";
import { hashPassword } from "./service.js";
import { requireAuth, requireRole } from "./middleware.js";
import { signAccessToken } from "./tokens.js";
import "./types.js";

// Minimal app that mounts an admin-only route to exercise requireRole.
const app = express();
app.use(express.json());
app.get("/admin-only", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({ ok: true });
});
// express error handler so thrown HttpErrors serialize to a status.
app.use(
  (
    err: { status?: number; code?: string; message?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(err.status ?? 500).json({ error: { code: err.code, message: err.message } });
  },
);

const TAG = "roleguardtest";
let adminToken: string;
let monteurToken: string;

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  const passwordHash = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId: org.id, email: `${TAG}-a@opero.test`, passwordHash, name: "A", role: "admin" },
  });
  const monteur = await prisma.user.create({
    data: { orgId: org.id, email: `${TAG}-m@opero.test`, passwordHash, name: "M", role: "monteur" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: admin.role, orgId: org.id });
  monteurToken = signAccessToken({ sub: monteur.id, role: monteur.role, orgId: org.id });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("requireRole", () => {
  it("401 without a token", async () => {
    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(401);
  });

  it("403 for a wrong-role user", async () => {
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${monteurToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("200 for the right role", async () => {
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
