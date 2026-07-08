import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Work-order PDF export (GET /work-orders/:id/pdf). Verifies:
//   - admin gets a valid application/pdf (%PDF- magic bytes);
//   - a technician assigned to the project can export it;
//   - a technician NOT on the project is blocked (404, visibility);
//   - the price-visible flag flows (admin PDF larger when prices shown) — a light
//     proxy for the price-stripping, since parsing PDF text is brittle.

const TAG = "wo-pdf";
let orgId: string;
let adminToken: string;
let techToken: string;
let outsiderToken: string;
let workOrderId: string;
let hidesPrices = true;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  // Reuse the shared org like the other work-order tests (creating a new one
  // would change what `organization.findFirst()` returns for parallel test
  // files). hidePricesFromTechnicians defaults to true, which is what we want —
  // so we assert on it rather than mutating the shared row (that would race).
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  // Only the price-diff assertion depends on prices being hidden from technicians.
  hidesPrices = org.hidePricesFromTechnicians;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-a@opero.test`, passwordHash: pw, name: "A", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const techEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Tech`, phone: "0600000000", roles: ["Technician"] },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-m@opero.test`, passwordHash: pw, name: "M", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  // A technician on NO project — must be blocked.
  const outEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Outsider`, phone: "0600000001", roles: ["Technician"] },
  });
  const outsider = await prisma.user.create({
    data: { orgId, email: `${TAG}-o@opero.test`, passwordHash: pw, name: "O", role: "technician", status: "active", employeeId: outEmp.id },
  });
  outsiderToken = signAccessToken({ sub: outsider.id, role: "technician", orgId });

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "Straat 1", postalCode: "1000AA", city: "Amsterdam" },
  });

  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  const projectId = projRes.body.id;
  // Assign the technician to the project so they can view it.
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { connect: { id: techEmp.id } } },
  });

  const woRes = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderId = woRes.body.id;

  // Add a task + a priced material so the PDF has content to lay out.
  const taskRes = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({});
  const taskId = taskRes.body.tasks[0].id as string;
  await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(adminToken))
    .send({ name: `${TAG} Steenwol`, quantity: 3, unit: "m2", unitPrice: 38 });
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { project: { name: { startsWith: TAG } } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.employee.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("work-order PDF export", () => {
  it("admin gets a valid PDF", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/pdf`)
      .set(auth(adminToken))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(res.headers["content-disposition"]).toContain(".pdf");
  });

  it("an assigned technician can export the PDF", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/pdf`)
      .set(auth(techToken))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect((res.body as Buffer).subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("a technician NOT on the project is blocked (404)", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/pdf`)
      .set(auth(outsiderToken));
    expect(res.status).toBe(404);
  });

  it("the technician's price-stripped PDF differs from the admin's (prices omitted)", async () => {
    const get = async (token: string) => {
      const res = await request(app)
        .get(`/api/work-orders/${workOrderId}/pdf`)
        .set(auth(token))
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => cb(null, Buffer.concat(chunks)));
        });
      return res.body as Buffer;
    };
    const adminPdf = await get(adminToken);
    const techPdf = await get(techToken);
    // Both are valid PDFs...
    expect(adminPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(techPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    // ...and when the org hides prices from technicians, they differ (the admin's
    // carries the price column + total, the technician's does not).
    if (hidesPrices) {
      expect(adminPdf.length).not.toBe(techPdf.length);
    }
  });
});
