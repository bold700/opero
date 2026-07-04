import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Role-access rules for the werkbon flow, per docs/roles-and-permissions.md:
//   - Technicians do NOT create werkbons (office/admin task) → POST /work-orders 403.
//   - Technicians do NOT get the customers list → GET /customers 403.
//   - Technicians see ONLY their own timesheet → GET /employees/:self/timesheet 200,
//     GET /employees/:other/timesheet 403.
//   - Admin can create werkbons.

const TAG = "wo-roleaccess";
let orgId: string;
let adminToken: string;
let techToken: string;
let techEmployeeId: string;
let otherEmployeeId: string;
let projectId: string; // technician IS assigned
let otherProjectId: string; // technician is NOT assigned

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

  const techEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Tech`, phone: "0600000000", roles: ["Technician"] },
  });
  techEmployeeId = techEmp.id;
  const otherEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Other`, phone: "0600000001", roles: ["Technician"] },
  });
  otherEmployeeId = otherEmp.id;

  const tech = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-m@opero.test`,
      passwordHash: pw,
      name: "M",
      role: "technician",
      status: "active",
      employeeId: techEmp.id,
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
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  // Create projects via the admin API (fills projectNumber/customerName/etc).
  // Project 1: the technician IS an installer → visible to them.
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { connect: { id: techEmp.id } } },
  });
  // Project 2: only the OTHER employee is on it → NOT visible to our technician.
  const otherProjRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} OtherProject` });
  otherProjectId = otherProjRes.body.id;
  await prisma.project.update({
    where: { id: otherProjectId },
    data: { installers: { connect: { id: otherEmployeeId } } },
  });
  // Give BOTH projects a work order so the list would show both if unscoped.
  await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId: otherProjectId });
  // Put BOTH projects on the planning calendar (plannedDate) so the feed would
  // include both if scoping were broken.
  await prisma.project.update({ where: { id: projectId }, data: { plannedDate: "2030-06-01" } });
  await prisma.project.update({ where: { id: otherProjectId }, data: { plannedDate: "2030-06-02" } });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("werkbon role access", () => {
  it("admin can create a work order", async () => {
    const res = await request(app)
      .post("/api/work-orders")
      .set(auth(adminToken))
      .send({ projectId });
    expect(res.status).toBe(201);
  });

  it("technician CANNOT create a work order (even on an assigned project)", async () => {
    const res = await request(app)
      .post("/api/work-orders")
      .set(auth(techToken))
      .send({ projectId });
    expect(res.status).toBe(403);
  });

  it("technician CANNOT list customers", async () => {
    const res = await request(app).get("/api/customers").set(auth(techToken));
    expect(res.status).toBe(403);
  });

  it("technician CAN read their OWN timesheet", async () => {
    const res = await request(app)
      .get(`/api/employees/${techEmployeeId}/timesheet`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe(techEmployeeId);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it("technician CANNOT read another employee's timesheet", async () => {
    const res = await request(app)
      .get(`/api/employees/${otherEmployeeId}/timesheet`)
      .set(auth(techToken));
    expect(res.status).toBe(403);
  });

  it("technician sees ONLY their assigned work orders, not all", async () => {
    // Admin sees both projects' work orders.
    const adminList = await request(app).get("/api/work-orders").set(auth(adminToken));
    const adminNumbers = new Set(
      (adminList.body.items as { number: string }[]).map((w) => w.number),
    );

    const res = await request(app).get("/api/work-orders").set(auth(techToken));
    expect(res.status).toBe(200);
    const rows = res.body.items as { id: string; number: string }[];
    // The technician's own project's work order IS present...
    const own = await prisma.project.findUnique({ where: { id: projectId }, select: { projectNumber: true } });
    const other = await prisma.project.findUnique({ where: { id: otherProjectId }, select: { projectNumber: true } });
    const techNumbers = new Set(rows.map((w) => w.number));
    expect(techNumbers.has(own!.projectNumber)).toBe(true);
    // ...but the unassigned project's work order is NOT.
    expect(techNumbers.has(other!.projectNumber)).toBe(false);
    // Admin (org-wide) DOES see the unassigned project — proving the technician's
    // list is a real, strict subset, not just an empty/equal one.
    expect(adminNumbers.has(other!.projectNumber)).toBe(true);
  });

  it("technician planning feed is scoped to their own projects, not all", async () => {
    const qs = "from=2000-01-01&to=2100-01-01";
    const adminPlan = await request(app).get(`/api/planning?${qs}`).set(auth(adminToken));
    const techPlan = await request(app).get(`/api/planning?${qs}`).set(auth(techToken));
    expect(techPlan.status).toBe(200);

    const adminIds = new Set((adminPlan.body as { projectId?: string }[]).map((p) => p.projectId));
    const techIds = new Set((techPlan.body as { projectId?: string }[]).map((p) => p.projectId));

    // Admin (org-wide) sees BOTH scheduled projects.
    expect(adminIds.has(projectId)).toBe(true);
    expect(adminIds.has(otherProjectId)).toBe(true);
    // Technician sees their OWN scheduled project but NOT the unassigned one.
    expect(techIds.has(projectId)).toBe(true);
    expect(techIds.has(otherProjectId)).toBe(false);
  });
});
