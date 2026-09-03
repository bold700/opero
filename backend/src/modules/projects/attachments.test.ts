import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Project-level file attachments (PDF/image). Verifies:
//   - office uploads a PDF → a row with the original filename appears in the
//     project DTO with a resolvable url;
//   - the file is visible from a werkbon in the project (projectAttachments),
//     read-only;
//   - a technician cannot upload or delete project files (403);
//   - delete removes the row (and it disappears from the DTO).

const TAG = "proj-attach";
let orgId: string;
let adminToken: string;
let techToken: string;
let projectId: string;
let workOrderId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Smallest thing that passes the %PDF- magic-byte sniff.
const pdfBytes = () => Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

// A minimal STORED zip with one empty entry — what an Office Open XML file is
// at the container level. The entry name is what the sniff keys on.
function zipWithEntry(name: string): Buffer {
  const n = Buffer.from(name, "ascii");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(n.length, 26); // name length
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central directory header
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42); // local header offset
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + n.length, 12);
  eocd.writeUInt32LE(local.length + n.length, 16);
  return Buffer.concat([local, n, central, n, eocd]);
}

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

  const customer = await prisma.customer.create({
    data: { orgId, name: `${TAG} Cust`, contactName: "C", email: "c@c.nl", phone: "", address: "", postalCode: "", city: "" },
  });
  const projRes = await request(app)
    .post("/api/projects")
    .set(auth(adminToken))
    .send({ customerId: customer.id, name: `${TAG} Project` });
  projectId = projRes.body.id;

  const woRes = await request(app).post("/api/work-orders").set(auth(adminToken)).send({ projectId });
  workOrderId = woRes.body.id;
  // Assignment is per WERKBON — grants the technician read access to it.
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

describe("project attachments", () => {
  it("admin uploads a PDF — row keeps the original filename + a url", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(adminToken))
      .attach("file", pdfBytes(), "Plattegrond.pdf");
    expect(res.status).toBe(201);
    const a = attachmentsOf(res.body).find((x) => x.filename === "Plattegrond.pdf");
    expect(a).toBeDefined();
    expect(a!.contentType).toBe("application/pdf");
    expect(a!.size).toBeGreaterThan(0);
    expect(a!.url).toBeTruthy();
  });

  it("the project file is visible from a werkbon in the project", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}`)
      .set(auth(techToken));
    expect(res.status).toBe(200);
    const files = (res.body.projectAttachments ?? []) as Attachment[];
    expect(files.some((x) => x.filename === "Plattegrond.pdf")).toBe(true);
    expect(files.find((x) => x.filename === "Plattegrond.pdf")!.url).toBeTruthy();
  });

  it("a technician cannot upload a project file (403)", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(techToken))
      .attach("file", pdfBytes(), "nope.pdf");
    expect(res.status).toBe(403);
  });

  it("a non-PDF/non-image file is rejected (400)", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(adminToken))
      .attach("file", Buffer.from("just some text, not a real file"), "notes.txt");
    expect(res.status).toBe(400);
  });

  it("Word (.docx) and Excel (.xlsx) are accepted with their real content types", async () => {
    const docx = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(adminToken))
      .attach("file", zipWithEntry("word/document.xml"), "Bestek.docx");
    expect(docx.status).toBe(201);
    const d = attachmentsOf(docx.body).find((x) => x.filename === "Bestek.docx");
    expect(d?.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const xlsx = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(adminToken))
      .attach("file", zipWithEntry("xl/workbook.xml"), "Meterstaat.xlsx");
    expect(xlsx.status).toBe(201);
    const x = attachmentsOf(xlsx.body).find((x) => x.filename === "Meterstaat.xlsx");
    expect(x?.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("a zip that is not an Office file is rejected (400)", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(adminToken))
      .attach("file", zipWithEntry("readme.txt"), "archive.zip");
    expect(res.status).toBe(400);
  });

  it("delete removes the attachment from the project", async () => {
    const up = await request(app)
      .post(`/api/projects/${projectId}/attachments`)
      .set(auth(adminToken))
      .attach("file", pdfBytes(), "todelete.pdf");
    const id = attachmentsOf(up.body).find((x) => x.filename === "todelete.pdf")!.id;

    const del = await request(app)
      .delete(`/api/projects/${projectId}/attachments/${id}`)
      .set(auth(adminToken));
    expect(del.status).toBe(200);
    expect(attachmentsOf(del.body).some((x) => x.id === id)).toBe(false);

    const row = await prisma.projectAttachment.findUnique({ where: { id } });
    expect(row).toBeNull();
  });
});
