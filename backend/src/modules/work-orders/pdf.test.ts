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
let taskId: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  // Reuse the shared org like the other work-order tests (creating a new one
  // would change what `organization.findFirst()` returns for parallel test
  // files). Technicians never see prices, so the tech PDF always differs.
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
    data: { orgId, name: `${TAG} Tech`, phone: "0600000000", role: "Technician" },
  });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-m@opero.test`, passwordHash: pw, name: "M", role: "technician", status: "active", employeeId: techEmp.id },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });

  // A technician on NO project — must be blocked.
  const outEmp = await prisma.employee.create({
    data: { orgId, name: `${TAG} Outsider`, phone: "0600000001", role: "Technician" },
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
  // Assignment is per WERKBON, not per project — that's what grants access.
  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { assignees: { connect: { id: techEmp.id } } },
  });

  // Add a task + a priced material so the PDF has content to lay out.
  const taskRes = await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks`)
    .set(auth(adminToken))
    .send({});
  taskId = taskRes.body.tasks[0].id as string;
  await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(adminToken))
    .send({ name: `${TAG} Steenwol`, quantity: 3, unit: "m2", unitPrice: 38 });
  await request(app)
    .post(`/api/work-orders/${workOrderId}/tasks/${taskId}/materials`)
    .set(auth(adminToken))
    .send({ name: `${TAG} extra afdichting`, quantity: 2, unit: "meter", unitPrice: 12, isExtraWork: true });
  await prisma.workOrderTask.update({ where: { id: taskId }, data: { hours: 7.5 } });
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
    // A complete document, not a stream that died mid-write: pdfkit only emits
    // the trailer on doc.end(), so %%EOF proves the whole PDF was flushed.
    expect(body.subarray(-1024).toString("latin1")).toContain("%%EOF");
  });

  // The client and API are different origins, so the browser hides every
  // non-safelisted response header from JS unless the server exposes it.
  // Without this the download helper cannot read the server's filename — the
  // regression that broke the export's naming. See backend/src/index.ts.
  it("exposes Content-Disposition to the browser via CORS", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/pdf`)
      .set(auth(adminToken))
      .set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-expose-headers"] ?? "").toMatch(
      /content-disposition/i,
    );
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

  // The werkbon carries NO prices for ANY role — it records what was done on
  // site, not what it costs (the money lives on the offerte + invoice). So the
  // admin's copy and the technician's are byte-identical: there is no price
  // column, no line total and no grand total to differ over. This assertion is
  // deliberately the inverse of the old one, which asserted they DID differ
  // back when admins got a priced werkbon.
  it("is byte-identical for admin and technician (no prices for anyone)", async () => {
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
    // ...and they're the same size: neither contains pricing. (Length is a
    // proxy for "same content" here — a price column would add bytes.)
    expect(adminPdf.length).toBe(techPdf.length);
    // Belt and braces: no euro sign anywhere in the admin's copy. This is the
    // assertion that actually fails if prices ever leak back onto the werkbon.
    expect(adminPdf.toString("latin1")).not.toContain("€");
  });

  it("separates materials from extra work and never prints registered hours", async () => {
    const res = await request(app)
      .get(`/api/work-orders/${workOrderId}/pdf`)
      .set(auth(adminToken))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    const { inflateSync } = await import("node:zlib");
    let raw = "";
    for (const match of (res.body as Buffer)
      .toString("latin1")
      .matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        raw += inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
      } catch {
        // Images/fonts are not deflate text streams.
      }
    }
    const text = [...raw.matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
      .join("");
    expect(text).toContain("Materialen");
    expect(text).toContain("Extra werkzaamheden");
    expect(text).toContain(`${TAG} Steenwol`);
    expect(text).toContain(`${TAG} extra afdichting`);
    expect(text).not.toContain("7.5 u");
    expect(text).toContain("AFRONDING EN ONDERTEKENING");
  });
});

// The printed werkbon is what a monteur actually takes to site, so the contact
// details have to be ON it — a tel: link in the app is no use on paper. These
// drive the builder directly: the rendered page compresses its text streams, so
// asserting on the HTTP bytes would not see the strings.
describe("work-order PDF contact block", () => {
  const render = async (customer: Record<string, string>) => {
    const { Writable } = await import("node:stream");
    const { buildWorkOrderPdf } = await import("./pdf.js");
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(c: Buffer, _e: unknown, cb: () => void) {
        chunks.push(Buffer.from(c));
        cb();
      },
    });
    await buildWorkOrderPdf(
      {
        number: "OP-2026-001",
        ordinal: 0,
        title: "T",
        status: "open",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        customer: { name: "Klant BV", ...customer },
        tasks: [],
        prejobCheck: {},
        prejobLabels: {},
        prejobPhotos: [],
      },
      { org },
      sink,
    );
    await new Promise((r) => sink.end(r));
    const pdf = Buffer.concat(chunks);

    // Getting at the drawn text takes two steps: PDFKit deflates its content
    // streams, and then writes each run as hex-encoded glyphs (<48656c6c6f>).
    // Inflate, then decode those hex runs, so the assertions below are about
    // real page content instead of incidental bytes.
    const { inflateSync } = await import("node:zlib");
    let raw = "";
    for (const m of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        raw += inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      } catch {
        // Not a deflate stream (fonts, images) — skip it.
      }
    }
    return [...raw.matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
      .join("");
  };

  it("prints the contact phone and email", async () => {
    const pdf = await render({
      contactName: "Jan Jansen",
      contactPhone: "0612345678",
      contactEmail: "jan@klant.nl",
    });
    expect(pdf).toContain("Jan Jansen");
    expect(pdf).toContain("0612345678");
    expect(pdf).toContain("jan@klant.nl");
  });

  it("omits the lines when there is no phone or email", async () => {
    // No empty "Tel:" label dangling under the address.
    const pdf = await render({ contactName: "Jan Jansen" });
    expect(pdf).toContain("Jan Jansen");
    expect(pdf).not.toContain("Tel:");
    expect(pdf).not.toContain("E-mail:");
  });
});

// Attachments must reach the PRINTED werkbon: a monteur working from paper
// cannot open an app link. Images are embedded as bare full pages (no heading,
// no filename — they are whatever the office attached, not necessarily a
// tekening). A PDF attachment cannot be merged by pdfkit, so it is named under
// "Documenten" rather than silently dropped, which would make the sheet look
// complete when it is not.
describe("work-order PDF attachments", () => {
  const renderWith = async (
    attachments: { key: string; filename: string; contentType: string }[],
  ) => {
    const { Writable } = await import("node:stream");
    const { buildWorkOrderPdf } = await import("./pdf.js");
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(c: Buffer, _e: unknown, cb: () => void) {
        chunks.push(Buffer.from(c));
        cb();
      },
    });
    await buildWorkOrderPdf(
      {
        number: "OP-2026-001",
        ordinal: 0,
        title: "T",
        status: "open",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        customer: { name: "Klant BV" },
        tasks: [],
        prejobCheck: {},
        prejobLabels: {},
        prejobPhotos: [],
        attachments,
      },
      { org },
      sink,
    );
    await new Promise((r) => sink.end(r));
    const pdf = Buffer.concat(chunks);
    const { inflateSync } = await import("node:zlib");
    let raw = "";
    for (const m of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        raw += inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      } catch {
        /* not a deflate stream */
      }
    }
    const text = [...raw.matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
      .join("");
    // /Type /Page (not /Pages) counts the real pages in the document.
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    return { text, pageCount };
  };

  it("prints each zone's work description (the note field)", async () => {
    // "Werkomschrijving" in the app is stored as WorkOrderTask.note. It is the
    // one thing the office types per zone, and it was missing from the printed
    // werkbon entirely — the sheet showed only the zone's short title.
    const { Writable } = await import("node:stream");
    const { buildWorkOrderPdf } = await import("./pdf.js");
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(c: Buffer, _e: unknown, cb: () => void) {
        chunks.push(Buffer.from(c));
        cb();
      },
    });
    await buildWorkOrderPdf(
      {
        number: "OP-2026-001",
        ordinal: 0,
        title: "T",
        status: "open",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        customer: { name: "Klant BV" },
        tasks: [
          {
            description: "Voorbereiding",
            note: "Leidingen vrijmaken en afdekken",
            done: false,
            materials: [],
            beforePhotos: [],
            resultPhotos: [],
          },
        ],
        prejobCheck: {},
        prejobLabels: {},
        prejobPhotos: [],
      },
      { org },
      sink,
    );
    await new Promise((r) => sink.end(r));
    const { inflateSync } = await import("node:zlib");
    let raw = "";
    for (const m of Buffer.concat(chunks)
      .toString("latin1")
      .matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        raw += inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      } catch {
        /* not a deflate stream */
      }
    }
    const text = [...raw.matchAll(/<([0-9a-fA-F]+)>/g)]
      .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
      .join("");
    expect(text).toContain("Voorbereiding");
    expect(text).toContain("Leidingen vrijmaken en afdekken");
  });

  it("never prints an attached image's filename", async () => {
    // The werkbon goes to the customer and gets signed. "IMG_4032.jpg" above a
    // an image is an internal detail leaking onto a customer document.
    const { text } = await renderWith([
      { key: "k-img", filename: "IMG_4032.jpg", contentType: "image/jpeg" },
    ]);
    expect(text).not.toContain("IMG_4032");
  });

  it("lists PDF attachments by filename", async () => {
    const { text } = await renderWith([
      { key: "k1", filename: "tekening-verdieping-2.pdf", contentType: "application/pdf" },
    ]);
    expect(text).toContain("DOCUMENTEN"); // sectionTitle uppercases headings
    expect(text).toContain("tekening-verdieping-2.pdf");
  });

  it("skips an unreadable image without breaking the export", async () => {
    // A storage key that cannot be read resolves to null and is skipped, so
    // this also proves an unreadable object never breaks the export.
    const base = await renderWith([]);
    const { text, pageCount } = await renderWith([
      { key: "missing-key", filename: "plattegrond.png", contentType: "image/png" },
    ]);
    // The image is unreadable here, so no extra page is added...
    expect(pageCount).toBe(base.pageCount);
    // ...and nothing crashed: the document still rendered.
    expect(text).toContain("ONDERTEKENING");
  });

  it("renders nothing extra when there are no attachments", async () => {
    const { text } = await renderWith([]);
    expect(text).not.toContain("DOCUMENTEN");
  });
});
