import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Dated employee absence: "allow vacation and absence periods to be scheduled
// per employee, so employees are automatically not scheduled or invoiced"
// (WOB Isolatie, 17-07-2026).
//
// Ranges are INCLUSIVE on both ends and stored as plain YYYY-MM-DD strings, so
// the boundary days are the interesting cases and get explicit coverage.

const TAG = "absence-test";
let orgId: string;
let adminToken: string;
let techToken: string;
let employeeId: string;
let customerId: string;
let workOrderId: string;

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

  const emp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Monteur`, phone: "", role: "Technician" },
  });
  employeeId = emp.id;

  const tech = await prisma.user.create({
    data: {
      orgId,
      email: `${TAG}-tech@opero.test`,
      passwordHash: pw,
      name: "Tech",
      role: "technician",
      status: "active",
      employeeId,
    },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  const cust = await prisma.customer.create({
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
  customerId = cust.id;

  const proj = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId, name: `${TAG} Proj` });
  const wo = await request(app)
    .post("/api/work-orders")
    .set(auth(adminToken))
    .send({ projectId: proj.body.id, title: `${TAG} WO` });
  workOrderId = wo.body.id;
});

afterAll(async () => {
  await prisma.employeeAbsence.deleteMany({ where: { orgId, employeeId } });
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

const createAbsence = (token: string, body: Record<string, unknown>) =>
  request(app).post("/api/employees/absences").set(auth(token)).send(body);

describe("employee absence CRUD", () => {
  let absenceId: string;

  it("creates a dated absence period", async () => {
    const res = await createAbsence(adminToken, {
      employeeId,
      kind: "vacation",
      startDate: "2026-08-03",
      endDate: "2026-08-17",
      note: "zomer",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employeeId,
      kind: "vacation",
      startDate: "2026-08-03",
      endDate: "2026-08-17",
    });
    absenceId = res.body.id;
  });

  it("rejects an inverted range", async () => {
    const res = await createAbsence(adminToken, {
      employeeId,
      startDate: "2026-09-10",
      endDate: "2026-09-01",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-ISO date", async () => {
    const res = await createAbsence(adminToken, {
      employeeId,
      startDate: "03-08-2026",
      endDate: "2026-08-17",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a single-day absence (start === end)", async () => {
    const res = await createAbsence(adminToken, {
      employeeId,
      kind: "sick",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
    });
    expect(res.status).toBe(201);
    await request(app)
      .delete(`/api/employees/absences/${res.body.id}`)
      .set(auth(adminToken));
  });

  it("is admin-only", async () => {
    const res = await createAbsence(techToken, {
      employeeId,
      startDate: "2026-11-01",
      endDate: "2026-11-02",
    });
    expect(res.status).toBe(403);

    const list = await request(app)
      .get("/api/employees/absences")
      .set(auth(techToken));
    expect(list.status).toBe(403);
  });

  it("lists absences overlapping a queried range", async () => {
    // A window that only touches the tail of the 03–17 Aug period.
    const res = await request(app)
      .get("/api/employees/absences")
      .query({ from: "2026-08-15", to: "2026-08-20", employeeId })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.map((a: { id: string }) => a.id)).toContain(absenceId);

    // A window entirely before it must not match.
    const before = await request(app)
      .get("/api/employees/absences")
      .query({ from: "2026-07-01", to: "2026-07-31", employeeId })
      .set(auth(adminToken));
    expect(before.body.map((a: { id: string }) => a.id)).not.toContain(absenceId);
  });

  it("deletes an absence", async () => {
    const created = await createAbsence(adminToken, {
      employeeId,
      startDate: "2026-12-01",
      endDate: "2026-12-02",
    });
    const del = await request(app)
      .delete(`/api/employees/absences/${created.body.id}`)
      .set(auth(adminToken));
    expect(del.status).toBe(204);
    expect(
      await prisma.employeeAbsence.findUnique({ where: { id: created.body.id } }),
    ).toBeNull();
  });
});

describe("absence blocks scheduling", () => {
  // The 03–17 Aug holiday from the CRUD block above is still in place here.

  it("annotates an absent employee on /assignable for that date", async () => {
    const res = await request(app)
      .get("/api/work-orders/assignable")
      .query({ date: "2026-08-10" })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    const row = res.body.find((r: { id: string }) => r.id === employeeId);
    // Still listed (a missing name reads as "no longer employed")…
    expect(row).toBeDefined();
    // …but flagged with the reason.
    expect(row.unavailable).toMatchObject({
      kind: "vacation",
      startDate: "2026-08-03",
      endDate: "2026-08-17",
    });
  });

  it("leaves them unannotated on a date outside the absence", async () => {
    const res = await request(app)
      .get("/api/work-orders/assignable")
      .query({ date: "2026-08-20" })
      .set(auth(adminToken));
    const row = res.body.find((r: { id: string }) => r.id === employeeId);
    expect(row.unavailable).toBeUndefined();
  });

  it("refuses to schedule an absent team leader", async () => {
    const res = await request(app)
      .post(`/api/planning/work-orders/${workOrderId}/planning`)
      .set(auth(adminToken))
      .send({ date: "2026-08-10", teamLeaderId: employeeId });
    expect(res.status).toBe(400);
    // The message names the person and the period, so the office can act on it.
    expect(res.body.error.message).toMatch(/unavailable/i);
    expect(res.body.error.message).toContain("2026-08-03");
  });

  // Boundary days are inclusive — the most likely place for an off-by-one.
  it("refuses on the first and last day of the absence", async () => {
    for (const date of ["2026-08-03", "2026-08-17"]) {
      const res = await request(app)
        .post(`/api/planning/work-orders/${workOrderId}/planning`)
        .set(auth(adminToken))
        .send({ date, teamLeaderId: employeeId });
      expect(res.status, `expected 400 on ${date}`).toBe(400);
    }
  });

  it("allows scheduling the day after the absence ends", async () => {
    const res = await request(app)
      .post(`/api/planning/work-orders/${workOrderId}/planning`)
      .set(auth(adminToken))
      .send({ date: "2026-08-18", teamLeaderId: employeeId });
    expect(res.status).toBe(201);
  });
});
