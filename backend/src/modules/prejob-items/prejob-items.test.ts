import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Admin CRUD for the org's pre-job checklist items + the dispatch gate using
// the org's ACTIVE items. Uses its OWN org so it doesn't disturb the shared org
// other work-order tests rely on.

const TAG = "prejob-items";
let orgId: string;
let adminToken: string;
let techToken: string;
let techEmployeeId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type Item = { id: string; key: string; label: string; ordinal: number; active: boolean };

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `${TAG}-org` } });
  orgId = org.id;

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const emp = await prisma.employee.create({
    data: { orgId, name: `${TAG}-tech`, phone: "0", role: "Technician", status: "active" },
  });
  techEmployeeId = emp.id;
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-t@opero.test`, passwordHash: pw, name: "T", role: "technician", status: "active", employeeId: emp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } });
  await prisma.prejobCheckItem.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("prejob-items CRUD", () => {
  let createdId = "";
  let secondId = "";

  it("admin creates an item — server generates a stable key", async () => {
    const res = await request(app)
      .post("/api/prejob-items")
      .set(auth(adminToken))
      .send({ label: "Steiger gecontroleerd" });
    expect(res.status).toBe(201);
    const item = res.body as Item;
    expect(item.key).toBe("steiger_gecontroleerd");
    expect(item.label).toBe("Steiger gecontroleerd");
    expect(item.active).toBe(true);
    createdId = item.id;
  });

  it("a duplicate label gets a de-duped key", async () => {
    const res = await request(app)
      .post("/api/prejob-items")
      .set(auth(adminToken))
      .send({ label: "Steiger gecontroleerd" });
    expect(res.status).toBe(201);
    expect((res.body as Item).key).toBe("steiger_gecontroleerd_2");
    secondId = (res.body as Item).id;
  });

  it("technician is forbidden (403)", async () => {
    const res = await request(app)
      .post("/api/prejob-items")
      .set(auth(techToken))
      .send({ label: "x" });
    expect(res.status).toBe(403);
  });

  it("edit changes the label but NOT the key", async () => {
    const res = await request(app)
      .patch(`/api/prejob-items/${createdId}`)
      .set(auth(adminToken))
      .send({ label: "Steiger + randbeveiliging" });
    expect(res.status).toBe(200);
    expect((res.body as Item).label).toBe("Steiger + randbeveiliging");
    expect((res.body as Item).key).toBe("steiger_gecontroleerd");
  });

  it("stores a reminder time and notification switch", async () => {
    const res = await request(app)
      .patch(`/api/prejob-items/${createdId}`)
      .set(auth(adminToken))
      .send({ reminderEnabled: true, reminderTime: "00:00" });
    expect(res.status).toBe(200);
    expect(res.body.reminderEnabled).toBe(true);
    expect(res.body.reminderTime).toBe("00:00");
  });

  it("reorder persists ordinals", async () => {
    const res = await request(app)
      .post("/api/prejob-items/reorder")
      .set(auth(adminToken))
      .send({ orderedIds: [secondId, createdId] });
    expect(res.status).toBe(200);
    const items = res.body as Item[];
    const first = items.find((i) => i.id === secondId)!;
    const second = items.find((i) => i.id === createdId)!;
    expect(first.ordinal).toBeLessThan(second.ordinal);
  });

  it("delete is a SOFT remove (active=false), row survives", async () => {
    const res = await request(app)
      .delete(`/api/prejob-items/${secondId}`)
      .set(auth(adminToken));
    expect(res.status).toBe(204);
    const row = await prisma.prejobCheckItem.findUnique({ where: { id: secondId } });
    expect(row).not.toBeNull();
    expect(row!.active).toBe(false);

    // And it drops out of the active list used by the werkbon.
    const { getPrejobItems } = await import("../../lib/prejobItems.js");
    const active = await getPrejobItems(orgId);
    expect(active.map((i) => i.key)).toContain("steiger_gecontroleerd");
    expect(active.map((i) => i.key)).not.toContain("steiger_gecontroleerd_2");
  });
});

type WoItem = {
  id: string;
  key: string;
  label: string;
  done: boolean;
  reminderEnabled: boolean;
  reminderTime?: string;
};
type WoBody = { id: string; prejobItems: WoItem[]; canDispatch: boolean };

describe("werkbon snapshots the template + per-werkbon gate", () => {
  it("creation copies the active template; ticking its items allows dispatch (no photo required by default)", async () => {
    // This org currently has exactly one ACTIVE item (the second was soft-removed
    // earlier). A new werkbon should snapshot exactly that one item, done=false.
    const customer = await prisma.customer.create({
      data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
    });
    const projRes = await request(app).post("/api/projects").set(auth(adminToken)).send({ customerId: customer.id, name: `${TAG} P` });
    const projectId = projRes.body.id;
    const woRes = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
    const wo = woRes.body as WoBody;
    const woId = wo.id;

    // Snapshot: one item, not done, not dispatchable yet.
    expect(wo.prejobItems.length).toBe(1);
    expect(wo.prejobItems[0].done).toBe(false);
    expect(wo.prejobItems[0].reminderEnabled).toBe(true);
    expect(wo.prejobItems[0].reminderTime).toBe("00:00");
    expect(wo.canDispatch).toBe(false);

    // Editing the TEMPLATE now must NOT change this werkbon's item.
    await request(app).post("/api/prejob-items").set(auth(adminToken)).send({ label: "Later added" }).expect(201);
    const stillOne = (await request(app).get(`/api/work-orders/${woId}`).set(auth(adminToken))).body as WoBody;
    expect(stillOne.prejobItems.length).toBe(1);

    // The assigned technician receives the timed control in the bell on the
    // previous workday and may complete it before office dispatch.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await prisma.workOrder.update({
      where: { id: woId },
      data: {
        plannedDate: tomorrow,
        assignees: { connect: { id: techEmployeeId } },
      },
    });
    const notifications = await request(app)
      .get("/api/notifications")
      .set(auth(techToken));
    expect(
      notifications.body.items.some(
        (item: { category: string; route: string }) =>
          item.category === "controlReminder" && item.route === `/work-orders/${woId}`,
      ),
    ).toBe(true);

    const technicianTick = await request(app)
      .patch(`/api/work-orders/${woId}/prejob-items/${wo.prejobItems[0].id}`)
      .set(auth(techToken))
      .send({ done: true });
    expect(technicianTick.status).toBe(200);
    expect(technicianTick.body.prejobItems[0].done).toBe(true);

    const clearedNotifications = await request(app)
      .get("/api/notifications")
      .set(auth(techToken));
    expect(
      clearedNotifications.body.items.some(
        (item: { category: string; route: string }) =>
          item.category === "controlReminder" && item.route === `/work-orders/${woId}`,
      ),
    ).toBe(false);

    // Tick the werkbon's own item via the per-werkbon route → complete → since
    // no photo is required by default, dispatch is allowed.
    const ticked = (await request(app)
      .patch(`/api/work-orders/${woId}/prejob-items/${wo.prejobItems[0].id}`)
      .set(auth(adminToken))
      .send({ done: true })
      .expect(200)).body as WoBody;
    expect(ticked.canDispatch).toBe(true);

    // Turn ON the per-werkbon photo requirement → dispatch blocked again (no photo).
    const required = (await request(app)
      .patch(`/api/work-orders/${woId}`)
      .set(auth(adminToken))
      .send({ prejobPhotoRequired: true })
      .expect(200)).body as WoBody;
    expect(required.canDispatch).toBe(false);
    const blocked = await request(app).post(`/api/work-orders/${woId}/dispatch`).set(auth(adminToken));
    expect(blocked.status).toBe(400);

    // A technician cannot edit the checklist (admin-only).
    const techForbidden = await request(app)
      .post(`/api/work-orders/${woId}/prejob-items`)
      .set(auth(techToken))
      .send({ label: "x" });
    expect(techForbidden.status).toBe(403);

    await prisma.workOrder.deleteMany({ where: { id: woId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.customer.deleteMany({ where: { id: customer.id } });
  });
});
