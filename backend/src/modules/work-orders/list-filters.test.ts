import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// The overview's narrowing filters: customer, assignee, work type and a
// planned-date range ("improve the filters in the work order overview, so work
// orders can easily be found afterwards" — WOB Isolatie, 17-07-2026).
//
// The important properties are that filters COMPOSE (they're ANDed, not
// last-one-wins) and that none of them can widen what a role may see.

const TAG = "wo-filters";
let orgId: string;
let adminToken: string;
let clientToken: string;
let customerAId: string;
let customerBId: string;
let employeeAId: string;
let employeeBId: string;
let workTypeId: string;
let woA: string; // customer A, employee A, 2026-08-10, has workType
let woB: string; // customer B, employee B, 2026-09-20, no workType

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const ids = (body: { items: { id: string }[] }) => body.items.map((i) => i.id);

async function makeCustomer(name: string) {
  return prisma.customer.create({
    data: {
      orgId,
      name: `${TAG} ${name}`,
      contactName: "C",
      email: `${TAG}-${name}@c.nl`,
      phone: "",
      address: "",
      postalCode: "",
      city: "",
    },
  });
}

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.workType.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-admin@opero.test`,
      passwordHash: pw,
      name: "Admin",
      role: "admin",
      status: "active",
    },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const custA = await makeCustomer("CustA");
  const custB = await makeCustomer("CustB");
  customerAId = custA.id;
  customerBId = custB.id;

  // A client login belonging to customer A only.
  const clientUser = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-client@opero.test`,
      passwordHash: pw,
      name: "Client",
      role: "client",
      status: "active",
      customerId: customerAId,
    },
  });
  // The token carries only sub/role/orgId; customerId is loaded from the user
  // row by the auth middleware.
  clientToken = signAccessToken({ sub: clientUser.id, role: "client", orgId });

  const empA = await prisma.employee.create({
    data: { orgId, name: `${TAG} MonteurA`, phone: "", roles: ["Technician"] },
  });
  const empB = await prisma.employee.create({
    data: { orgId, name: `${TAG} MonteurB`, phone: "", roles: ["Technician"] },
  });
  employeeAId = empA.id;
  employeeBId = empB.id;

  const wt = await prisma.workType.create({
    data: { orgId, name: `${TAG} Dakisolatie` },
  });
  workTypeId = wt.id;

  // Two work orders that differ on every filterable axis.
  const projA = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customerAId, name: `${TAG} ProjA` });
  const projB = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customerBId, name: `${TAG} ProjB` });

  const resA = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: projA.body.id, title: `${TAG} A` });
  const resB = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: projB.body.id, title: `${TAG} B` });
  woA = resA.body.id;
  woB = resB.body.id;

  await prisma.workOrder.update({
    where: { id: woA },
    data: { plannedDate: "2026-08-10", assignees: { connect: { id: employeeAId } } },
  });
  await prisma.workOrder.update({
    where: { id: woB },
    data: { plannedDate: "2026-09-20", assignees: { connect: { id: employeeBId } } },
  });

  // Work type is per zone, so tag one of A's zones with it.
  const zone = await request(app)
    .post(`/api/work-orders/${woA}/tasks`)
    .set(auth(adminToken))
    .send({});
  const zoneId = zone.body.tasks[zone.body.tasks.length - 1].id;
  await request(app)
    .patch(`/api/work-orders/${woA}/tasks/${zoneId}`)
    .set(auth(adminToken))
    .send({ workTypeId });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.workType.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

const list = (token: string, query: Record<string, string>) =>
  request(app).get("/api/work-orders").query(query).set(auth(token));

describe("work-order list filters", () => {
  it("filters by customer", async () => {
    const res = await list(adminToken, { customerId: customerAId, search: TAG });
    expect(res.status).toBe(200);
    expect(ids(res.body)).toContain(woA);
    expect(ids(res.body)).not.toContain(woB);
  });

  it("filters by assignee", async () => {
    const res = await list(adminToken, { assigneeId: employeeBId, search: TAG });
    expect(ids(res.body)).toContain(woB);
    expect(ids(res.body)).not.toContain(woA);
  });

  it("filters by work type (matched via any zone)", async () => {
    const res = await list(adminToken, { workTypeId, search: TAG });
    expect(ids(res.body)).toContain(woA);
    expect(ids(res.body)).not.toContain(woB);
  });

  it("filters by planned-date range, inclusive on both ends", async () => {
    const inside = await list(adminToken, {
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      search: TAG,
    });
    expect(ids(inside.body)).toContain(woA);
    expect(ids(inside.body)).not.toContain(woB);

    // A single-day range covering exactly the planned date still matches.
    const exact = await list(adminToken, {
      dateFrom: "2026-08-10",
      dateTo: "2026-08-10",
      search: TAG,
    });
    expect(ids(exact.body)).toContain(woA);
  });

  it("composes filters with AND, not last-one-wins", async () => {
    // Customer A but employee B → matches neither work order.
    const res = await list(adminToken, {
      customerId: customerAId,
      assigneeId: employeeBId,
      search: TAG,
    });
    expect(ids(res.body)).not.toContain(woA);
    expect(ids(res.body)).not.toContain(woB);
  });

  it("ignores an unparseable date instead of erroring", async () => {
    const res = await list(adminToken, { dateFrom: "not-a-date", search: TAG });
    expect(res.status).toBe(200);
    expect(ids(res.body)).toContain(woA);
  });

  // The filter must never be a way to widen visibility. A client's customer
  // scoping is their identity, not a default they can override.
  it("a client cannot use customerId to see another customer's work orders", async () => {
    const res = await list(clientToken, { customerId: customerBId });
    expect(res.status).toBe(200);
    expect(ids(res.body)).not.toContain(woB);
  });
});

describe("GET /work-orders/filter-options", () => {
  it("returns customers, assignees and work types for an admin", async () => {
    const res = await request(app)
      .get("/api/work-orders/filter-options")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    const customerIds = res.body.customers.map((c: { id: string }) => c.id);
    expect(customerIds).toEqual(expect.arrayContaining([customerAId, customerBId]));
    expect(res.body.assignees.map((a: { id: string }) => a.id)).toEqual(
      expect.arrayContaining([employeeAId, employeeBId]),
    );
    expect(res.body.workTypes.map((w: { id: string }) => w.id)).toContain(workTypeId);
  });

  it("scopes the customer list for a client, and offers them no assignees", async () => {
    const res = await request(app)
      .get("/api/work-orders/filter-options")
      .set(auth(clientToken));
    expect(res.status).toBe(200);
    const customerIds = res.body.customers.map((c: { id: string }) => c.id);
    expect(customerIds).toContain(customerAId);
    expect(customerIds).not.toContain(customerBId);
    expect(res.body.assignees).toEqual([]);
  });
});
