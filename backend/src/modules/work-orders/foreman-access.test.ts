import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canActOnAccount,
  canGrantRole,
  canSeeAllProjects,
  canSeeMargin,
  canSeePrices,
  grantableRoles,
  isOffice,
} from "@opero/shared";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// The foreman (meewerkend uitvoerder), per shared/src/permissions.ts:
//   - Sees EVERY werkbon and the WHOLE planning, without being assigned.
//   - Registers like a technician (hours etc.) on ANY werkbon.
//   - Never sees prices; never edits the quoted scope.
//   - No customers list, no reports, no invoices, no user management,
//     no planning writes. Own timesheet only.

const TAG = "wo-foremanaccess";
let orgId: string;
let adminToken: string;
let foremanToken: string;
let foremanEmployeeId: string;
let otherEmployeeId: string;
let projectAId: string; // foreman assigned to NEITHER project
let projectBId: string;
let workOrderAId: string;
let taskAId: string; // task on werkbon A, with a priced material line

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });

  const foremanEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Foreman`, phone: "0600000000", role: "Foreman" },
  });
  foremanEmployeeId = foremanEmp.id;
  const otherEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Other`, phone: "0600000001", role: "Technician" },
  });
  otherEmployeeId = otherEmp.id;

  const foreman = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-f@opero.test`,
      passwordHash: pw,
      name: "F",
      role: "foreman",
      status: "active",
      employeeId: foremanEmp.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      orgId,
      name: `${TAG} Cust`,
      contactName: "C",
      email: "c@c.nl",
      phone: "",
      address: "",
      postalCode: "",
      city: "",
    },
  });

  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
  foremanToken = signAccessToken({ sub: foreman.id, role: "foreman", orgId });

  // Two projects, the foreman assigned to NEITHER (that's the point) — only
  // the OTHER employee is on them. A technician in this position sees nothing.
  const projA = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} ProjectA` });
  projectAId = projA.body.id;
  const projB = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} ProjectB` });
  projectBId = projB.body.id;
  for (const id of [projectAId, projectBId]) {
    await prisma.project.update({
      where: { id },
      data: { installers: { connect: { id: otherEmployeeId } } },
    });
  }

  const woA = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId: projectAId });
  workOrderAId = woA.body.id;
  const woB = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId: projectBId });
  await prisma.workOrder.update({ where: { id: workOrderAId }, data: { plannedDate: "2030-07-01" } });
  await prisma.workOrder.update({ where: { id: woB.body.id }, data: { plannedDate: "2030-07-02" } });

  // A task with a PRICED material line, seeded directly: the DTO must strip
  // unitPrice/costPrice for the foreman but keep them for the admin.
  const task = await prisma.workOrderTask.create({
    data: { workOrderId: workOrderAId, description: `${TAG} zone` },
  });
  taskAId = task.id;
  await prisma.taskMaterial.create({
    data: { taskId: task.id, name: `${TAG} mat`, quantity: 2, unit: "m2", unitPrice: 12.5, costPrice: 7.5 },
  });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("permissions predicates (shared)", () => {
  it("foreman sees all projects but is NOT the office", () => {
    expect(canSeeAllProjects("foreman")).toBe(true);
    expect(isOffice("foreman")).toBe(false);
  });

  it("foreman never sees prices or margins", () => {
    expect(canSeePrices("foreman")).toBe(false);
    expect(canSeeMargin("foreman")).toBe(false);
  });

  it("office manages foreman accounts; foreman manages nobody", () => {
    expect(canActOnAccount("office", "foreman")).toBe(true);
    expect(canActOnAccount("foreman", "technician")).toBe(false);
    expect(canGrantRole("office", "foreman")).toBe(true);
    expect(grantableRoles("office")).toContain("foreman");
    expect(grantableRoles("admin")).toContain("foreman");
  });
});

describe("foreman org-wide visibility", () => {
  it("sees BOTH projects' work orders without any assignment", async () => {
    const res = await request(app).get("/api/work-orders").set(auth(foremanToken));
    expect(res.status).toBe(200);
    const numbers = new Set((res.body.items as { number: string }[]).map((w) => w.number));
    const a = await prisma.project.findUnique({ where: { id: projectAId }, select: { projectNumber: true } });
    const b = await prisma.project.findUnique({ where: { id: projectBId }, select: { projectNumber: true } });
    expect(numbers.has(a!.projectNumber)).toBe(true);
    expect(numbers.has(b!.projectNumber)).toBe(true);
  });

  it("planning feed contains EVERYONE's scheduled projects", async () => {
    const qs = "from=2000-01-01&to=2100-01-01";
    const res = await request(app).get(`/api/planning?${qs}`).set(auth(foremanToken));
    expect(res.status).toBe(200);
    const ids = new Set((res.body as { projectId?: string }[]).map((p) => p.projectId));
    expect(ids.has(projectAId)).toBe(true);
    expect(ids.has(projectBId)).toBe(true);
  });

  it("gets the org-wide, money-free dashboard payload", async () => {
    const res = await request(app).get("/api/dashboard").set(auth(foremanToken));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("foreman");
    // Technician-shaped: no money aggregates ever.
    expect(res.body.pipelineValue).toBeUndefined();
    expect(res.body.openInvoices).toBeUndefined();
    // Org-wide: both (unassigned) projects are counted.
    expect(res.body.assignedProjectCount).toBeGreaterThanOrEqual(2);
  });
});

describe("foreman registration rights (technician-style, on ANY werkbon)", () => {
  it("can register hours on an unassigned werkbon's task", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderAId}/tasks/${taskAId}/hours`)
      .set(auth(foremanToken))
      .send({ hours: 3 });
    expect(res.status).toBe(200);
  });

  it("work-order DTO strips ALL price fields for the foreman", async () => {
    const res = await request(app).get(`/api/work-orders/${workOrderAId}`).set(auth(foremanToken));
    expect(res.status).toBe(200);
    const flat = JSON.stringify(res.body);
    expect(flat.includes("unitPrice")).toBe(false);
    expect(flat.includes("costPrice")).toBe(false);
    // Sanity: the same DTO DOES carry prices for the admin, so the material
    // line above really would have leaked if stripping were broken.
    const adminRes = await request(app).get(`/api/work-orders/${workOrderAId}`).set(auth(adminToken));
    expect(JSON.stringify(adminRes.body).includes("unitPrice")).toBe(true);
  });

  it("CANNOT edit the quoted scope (PATCH /work-orders/:id is office-only)", async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${workOrderAId}`)
      .set(auth(foremanToken))
      .send({ title: "rewritten" });
    expect(res.status).toBe(403);
  });

  it("CANNOT create a work order", async () => {
    const res = await request(app)
      .post("/api/work-orders")
      .set(auth(foremanToken))
      .send({ projectId: projectAId });
    expect(res.status).toBe(403);
  });
});

describe("foreman section denials", () => {
  it("CANNOT list customers", async () => {
    const res = await request(app).get("/api/customers").set(auth(foremanToken));
    expect(res.status).toBe(403);
  });

  it("CANNOT access company reports", async () => {
    const res = await request(app).get("/api/reports").set(auth(foremanToken));
    expect(res.status).toBe(403);
  });

  it("CANNOT access invoices", async () => {
    const res = await request(app).get("/api/invoices").set(auth(foremanToken));
    expect(res.status).toBe(403);
  });

  it("CANNOT manage users", async () => {
    const res = await request(app).get("/api/users").set(auth(foremanToken));
    expect(res.status).toBe(403);
  });

  it("CANNOT write to the planning (read-only)", async () => {
    const res = await request(app)
      .post(`/api/planning/work-orders/${workOrderAId}/planning`)
      .set(auth(foremanToken))
      .send({ date: "2030-07-03" });
    expect(res.status).toBe(403);
  });

  it("global search returns NO customers for the foreman", async () => {
    const res = await request(app).get(`/api/search?q=${TAG}`).set(auth(foremanToken));
    expect(res.status).toBe(200);
    expect(res.body.customers).toEqual([]);
    // ...while projects/work orders (org-wide visible) DO surface.
    expect((res.body.projects as unknown[]).length).toBeGreaterThan(0);
  });

  it("reads their OWN timesheet, but nobody else's", async () => {
    const own = await request(app)
      .get(`/api/employees/${foremanEmployeeId}/timesheet`)
      .set(auth(foremanToken));
    expect(own.status).toBe(200);
    const other = await request(app)
      .get(`/api/employees/${otherEmployeeId}/timesheet`)
      .set(auth(foremanToken));
    expect(other.status).toBe(403);
  });
});
