import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../index.js";
import { prisma } from "../../db/client.js";
import { hashPassword } from "../../auth/service.js";

// The notifications feed is derived + role-scoped + preference-gated. This test
// drives the admin path (urgent projects) and the seen flow against the seeded
// data, plus a preference-gating check.

const TAG = "notiftest";
const adminEmail = `${TAG}-admin@opero.test`;
let adminToken: string;
let orgId: string;

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: "pw-notif-123" });
  return res.body.accessToken;
}

beforeAll(async () => {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("seed org required");
  orgId = org.id;
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { notificationsSeenAt: null, preferences: undefined },
    create: {
      email: adminEmail,
      name: "Notif Admin",
      passwordHash: await hashPassword("pw-notif-123"),
      role: "admin",
      orgId,
    },
  });
  adminToken = await login(adminEmail);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: adminEmail } });
});

describe("GET /notifications", () => {
  it("returns a role-scoped feed with an unread count", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // Seeded data has urgent/blocked projects → admin should see some.
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.unreadCount).toBe(res.body.items.length); // never seen yet
    // Every item is shaped correctly.
    for (const item of res.body.items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.messageKey).toBe("string");
      expect(typeof item.route).toBe("string");
    }
  });

  it("clears unread after POST /seen", async () => {
    const before = await request(app)
      .get("/api/notifications")
      .set("authorization", `Bearer ${adminToken}`);
    expect(before.body.unreadCount).toBeGreaterThan(0);

    const seen = await request(app)
      .post("/api/notifications/seen")
      .set("authorization", `Bearer ${adminToken}`);
    expect(seen.status).toBe(200);

    const after = await request(app)
      .get("/api/notifications")
      .set("authorization", `Bearer ${adminToken}`);
    expect(after.body.unreadCount).toBe(0);
  });

  it("omits a category when its preference toggle is off", async () => {
    // Turn off urgentOnSite → the urgent items should disappear.
    await request(app)
      .patch("/api/auth/preferences")
      .set("authorization", `Bearer ${adminToken}`)
      .send({ notifications: { urgentOnSite: false } });

    const res = await request(app)
      .get("/api/notifications")
      .set("authorization", `Bearer ${adminToken}`);
    expect(res.body.items.every((i: { category: string }) => i.category !== "urgentOnSite")).toBe(true);

    // Restore.
    await request(app)
      .patch("/api/auth/preferences")
      .set("authorization", `Bearer ${adminToken}`)
      .send({ notifications: { urgentOnSite: true } });
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });
});
