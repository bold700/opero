import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Work-order file attachments (PDF/image). Verifies:
//   - admin uploads a PDF → a row with the original filename appears in the DTO
//     with a resolvable url;
//   - an assigned technician can upload; an unassigned one is blocked (404);
//   - a disguised/non-allowed file is rejected (400);
//   - delete removes the row (and it disappears from the DTO).

const TAG = "wo-attach";
let orgId: string;
let adminToken: string;
let techToken: string;
let outsiderToken: string;
let workOrderId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Smallest thing that passes the %PDF- magic-byte sniff.
const pdfBytes = () => Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

type Attachment = { id: string; filename: string; contentType: string; size: number; url?: string };
const attachmentsOf = (body: { attachments: Attachment[] }) => body.attachments ?? [];

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
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });

  const techEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Tech`, phone: "0", role: "Technician", status: "active" },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-m@opero.test`, passwordHash: pw, name: "M", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  const outEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Outsider`, phone: "0", role: "Technician", status: "active" },
  });
  const outsider = await prisma.user.create({
    data: { orgId, email: `${TAG}-o@opero.test`, passwordHash: pw, name: "O", role: "technician", status: "active", employeeId: outEmp.id },
  });
  outsiderToken = signAccessToken({ sub: outsider.id, role: "technician", orgId });

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  const projectId = projRes.body.id;
  await prisma.project.update({
    where: { id: projectId },
    data: { installers: { connect: { id: techEmp.id } } },
  });

  const woRes = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderId = woRes.body.id;
  // Assignment is per WERKBON, not per project — that's what grants access.
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { assignees: { connect: { id: techEmp.id } }, dispatchedAt: new Date() },
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

describe("work-order attachments", () => {
  it("admin uploads a PDF — row keeps the original filename + a url", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/attachments`)
      .set(auth(adminToken))
      .attach("file", pdfBytes(), "Offerte Jansen.pdf");
    expect(res.status).toBe(201);
    const a = attachmentsOf(res.body).find((x) => x.filename === "Offerte Jansen.pdf");
    expect(a).toBeDefined();
    expect(a!.contentType).toBe("application/pdf");
    expect(a!.size).toBeGreaterThan(0);
    expect(a!.url).toBeTruthy();
  });

  it("an assigned technician can upload", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/attachments`)
      .set(auth(techToken))
      .attach("file", pdfBytes(), "tech.pdf");
    expect(res.status).toBe(201);
    expect(attachmentsOf(res.body).some((x) => x.filename === "tech.pdf")).toBe(true);
  });

  it("a technician NOT on the project is blocked (404)", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/attachments`)
      .set(auth(outsiderToken))
      .attach("file", pdfBytes(), "nope.pdf");
    expect(res.status).toBe(404);
  });

  it("a non-PDF/non-image file is rejected (400)", async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/attachments`)
      .set(auth(adminToken))
      .attach("file", Buffer.from("just some text, not a real file"), "notes.txt");
    expect(res.status).toBe(400);
  });

  it("delete removes the attachment from the work order", async () => {
    const up = await request(app)
      .post(`/api/work-orders/${workOrderId}/attachments`)
      .set(auth(adminToken))
      .attach("file", pdfBytes(), "todelete.pdf");
    const id = attachmentsOf(up.body).find((x) => x.filename === "todelete.pdf")!.id;

    const del = await request(app)
      .delete(`/api/work-orders/${workOrderId}/attachments/${id}`)
      .set(auth(adminToken));
    expect(del.status).toBe(200);
    expect(attachmentsOf(del.body).some((x) => x.id === id)).toBe(false);

    const row = await prisma.workOrderAttachment.findUnique({ where: { id } });
    expect(row).toBeNull();
  });
});
