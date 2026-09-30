import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

const TAG = "work-day-ledger";
const day = new Date().toISOString().slice(0, 10);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let adminToken: string;
let technicianToken: string;
let workOrderId: string;
let materialId: string;
let requirementId: string;

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  const passwordHash = await hashPassword("x");
  const admin = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `${TAG}-admin@opero.test`,
      passwordHash,
      name: "Ledger admin",
      role: "admin",
      status: "active",
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId: org.id });
  const employee = await prisma.employee.create({
    data: {
      orgId: org.id,
      name: `${TAG}-technician`,
      phone: "0",
      role: "Technician",
      status: "active",
    },
  });
  const technician = await prisma.user.create({
    data: {
      orgId: org.id,
      email: `${TAG}-technician@opero.test`,
      passwordHash,
      name: "Ledger technician",
      role: "technician",
      status: "active",
      employeeId: employee.id,
    },
  });
  technicianToken = signAccessToken({
    sub: technician.id,
    role: "technician",
    orgId: org.id,
  });
  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: `${TAG} customer`,
      contactName: "Contact",
      email: `${TAG}@example.test`,
      phone: "",
      address: "",
      postalCode: "",
      city: "",
    },
  });
  const project = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} project` });
  const created = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: project.body.id, title: "Daily material test" });
  workOrderId = created.body.id;
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { assignees: { connect: { id: employee.id } }, dispatchedAt: new Date() },
  });
  const withTask = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({});
  const taskId = withTask.body.tasks[0].id;
  const withMaterial = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(adminToken))
    .send({ name: "Test insulation", quantity: 100, unit: "meter" });
  materialId = withMaterial.body.tasks[0].materials[0].id;
  const withRequirement = await request(app)
    .post(`/api/work-orders/${workOrderId}/requirements`)
    .set(auth(adminToken))
    .send({ name: "Drill", kind: "tool", quantity: 1, unit: "piece" });
  requirementId = withRequirement.body.requirements[0].id;
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("daily work-order material ledger", () => {
  it("starts from prefilled task materials, requirements and a loose item", async () => {
    const response = await request(app)
      .post(`/api/work-orders/${workOrderId}/work-days/${day}/start`)
      .set(auth(technicianToken))
      .send({
        entries: [
          {
            taskMaterialId: materialId,
            name: "ignored client label",
            unit: "ignored",
            kind: "production",
            plannedQuantity: 100,
            openingOnSite: 10,
            brought: 50,
          },
          {
            requirementId,
            name: "ignored client tool",
            kind: "tool",
            openingOnSite: 0,
            brought: 1,
          },
          {
            name: "Tape",
            unit: "roll",
            kind: "consumable",
            openingOnSite: 0,
            brought: 2,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.workDays[0].status).toBe("started");
    expect(response.body.workDays[0].entries).toHaveLength(3);
    expect(response.body.workDays[0].entries[0].name).toBe("Test insulation");
    expect(response.body.workDays[0].entries[1].name).toBe("Drill");

    const secondStart = await request(app)
      .post(`/api/work-orders/${workOrderId}/work-days/2099-12-31/start`)
      .set(auth(technicianToken))
      .send({
        entries: [{
          name: "Other",
          kind: "other",
          openingOnSite: 0,
          brought: 1,
        }],
      });
    expect(secondStart.status).toBe(400);
  });

  it("rejects an end-of-day balance that does not close", async () => {
    const workOrder = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(technicianToken));
    const entries = workOrder.body.workDays[0].entries.map((entry: { id: string }) => ({
      id: entry.id,
      openingOnSite: 0,
      brought: 0,
      delivered: 0,
      installed: 1,
      waste: 0,
      leftOnSite: 0,
      returned: 0,
    }));
    const response = await request(app)
      .post(`/api/work-orders/${workOrderId}/work-days/${day}/complete`)
      .set(auth(technicianToken))
      .send({ entries });
    expect(response.status).toBe(400);
  });

  it("closes the balance and updates progress, stock and tomorrow's advice", async () => {
    const workOrder = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(technicianToken));
    const byName = new Map(
      workOrder.body.workDays[0].entries.map((entry: { name: string; id: string }) => [entry.name, entry]),
    );
    const response = await request(app)
      .post(`/api/work-orders/${workOrderId}/work-days/${day}/complete`)
      .set(auth(technicianToken))
      .send({
        entries: [
          {
            id: (byName.get("Test insulation") as { id: string }).id,
            openingOnSite: 10,
            brought: 50,
            delivered: 0,
            installed: 40,
            waste: 2,
            leftOnSite: 15,
            returned: 3,
          },
          {
            id: (byName.get("Drill") as { id: string }).id,
            openingOnSite: 0,
            brought: 1,
            delivered: 0,
            installed: 0,
            waste: 0,
            leftOnSite: 0,
            returned: 1,
          },
          {
            id: (byName.get("Tape") as { id: string }).id,
            openingOnSite: 0,
            brought: 2,
            delivered: 0,
            installed: 1,
            waste: 0,
            leftOnSite: 1,
            returned: 0,
          },
        ],
      });

    expect(response.status).toBe(200);
    const material = response.body.tasks[0].materials[0];
    expect(material.progressTotal).toBe(40);
    expect(material.usedQuantity).toBe(42);
    expect(material.issuedQuantity).toBe(50);
    expect(material.returnedQuantity).toBe(3);
    expect(material.onSite).toBe(true);
    const advice = response.body.materialPlan.find(
      (item: { taskMaterialId?: string }) => item.taskMaterialId === materialId,
    );
    expect(advice.openingOnSite).toBe(15);
    expect(advice.suggestedBrought).toBe(45);
  });

  it("notifies the office about the calculated shortage", async () => {
    const response = await request(app).get("/api/notifications").set(auth(adminToken));
    expect(response.status).toBe(200);
    const notification = response.body.items.find(
      (item: { category: string; route: string }) =>
        item.category === "materialShortage" && item.route === `/work-orders/${workOrderId}`,
    );
    expect(notification).toBeDefined();
    expect(notification.params.items).toContain("45 meter Test insulation");
  });

  it("clears the office shortage after the replenishment is marked ready", async () => {
    const ready = await request(app)
      .patch(`/api/work-orders/${workOrderId}/materials/${materialId}`)
      .set(auth(adminToken))
      .send({ requirementDone: true });
    expect(ready.status).toBe(200);
    const advice = ready.body.materialPlan.find(
      (item: { taskMaterialId?: string }) => item.taskMaterialId === materialId,
    );
    expect(advice.ready).toBe(true);

    const notifications = await request(app).get("/api/notifications").set(auth(adminToken));
    const item = notifications.body.items.find(
      (candidate: { category: string; route: string }) =>
        candidate.category === "materialShortage" &&
        candidate.route === `/work-orders/${workOrderId}`,
    );
    expect(item).toBeUndefined();
  });

  it("lets only the office correct a completed day and applies deltas", async () => {
    const current = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(adminToken));
    const entries = current.body.workDays[0].entries.map((entry: {
      id: string;
      name: string;
      openingOnSite: number;
      brought: number;
      delivered: number;
      installed: number;
      waste: number;
      leftOnSite: number;
      returned: number;
    }) => entry.name === "Test insulation"
      ? { ...entry, installed: 45, leftOnSite: 8, returned: 5 }
      : entry,
    );
    const payload = { entries: entries.map(({ id, openingOnSite, brought, delivered, installed, waste, leftOnSite, returned }: {
      id: string;
      openingOnSite: number;
      brought: number;
      delivered: number;
      installed: number;
      waste: number;
      leftOnSite: number;
      returned: number;
    }) => ({ id, openingOnSite, brought, delivered, installed, waste, leftOnSite, returned })) };

    const denied = await request(app)
      .post(`/api/work-orders/${workOrderId}/work-days/${day}/complete`)
      .set(auth(technicianToken))
      .send(payload);
    expect(denied.status).toBe(400);

    const corrected = await request(app)
      .post(`/api/work-orders/${workOrderId}/work-days/${day}/complete`)
      .set(auth(adminToken))
      .send(payload);
    expect(corrected.status).toBe(200);
    const material = corrected.body.tasks[0].materials[0];
    expect(material.progressTotal).toBe(45);
    expect(material.usedQuantity).toBe(47);
    expect(material.returnedQuantity).toBe(5);
    const advice = corrected.body.materialPlan.find(
      (item: { taskMaterialId?: string }) => item.taskMaterialId === materialId,
    );
    expect(advice.openingOnSite).toBe(8);
    expect(advice.suggestedBrought).toBe(47);
  });
});
