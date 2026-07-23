import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

const { default: request } = await import("supertest");
const { app } = await import("../../index.js");
const { prisma } = await import("../../db/client.js");
const { hashPassword } = await import("../../auth/service.js");
const { signAccessToken } = await import("../../auth/tokens.js");

// Silvasoft "Export → Excel" customer import. Mirrors the real export the
// client provided: mostly-blank email/phone, a Bedrijf/Particulier type
// column, a "Naam is niet bepaald" junk row, and a "Nummer" that dedupes a
// re-import.

const TAG = "silva-import";
let orgId: string;
let adminToken: string;
let techToken: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Column order matches the real export's header row.
const HEADERS = [
  "Nummer", "Naam", "Telefoon", "E-mailadres", "Adres", "Postcode", "Plaats",
  "Type", "KvK-nummer", "BTW-nummer", "contactpersoon", "Betaaltermijn (dgn)",
];

async function buildWorkbook(rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Export");
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// A file with: two businesses, one private person, one junk (no-name) row.
function sampleRows() {
  return [
    [`${TAG}-1`, `${TAG} Alpha B.V.`, null, null, "Straat 1", "1000 AA", "AMSTERDAM", "Bedrijf", "12345678", "NL0011B01", null, 0],
    [`${TAG}-2`, `${TAG} Beta Beheer`, "0612345678", "beta@x.nl", "Straat 2", "2000 BB", "UTRECHT", "Bedrijf", null, null, null, 0],
    [`${TAG}-3`, `Dhr/mevr. ${TAG} Klaas`, null, "klaas@x.nl", "Laan 3", "3000 CC", "DEN HAAG", "Particulier", null, null, null, 0],
    [`${TAG}-4`, "Naam is niet bepaald", null, null, "Weg 4", null, "BREDA", "Bedrijf", null, null, null, 0],
  ];
}

beforeAll(async () => {
  const org =
    (await prisma.organization.findFirst()) ??
    (await prisma.organization.create({ data: { name: "Test Org" } }));
  orgId = org.id;
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.customer.deleteMany({ where: { OR: [{ name: { startsWith: TAG } }, { silvasoftId: { startsWith: TAG } }] } });

  const pw = await hashPassword("x");
  const admin = await prisma.user.create({
    data: { orgId, email: `${TAG}-admin@opero.test`, passwordHash: pw, name: "Admin", role: "admin", status: "active" },
  });
  adminToken = signAccessToken({ sub: admin.id, role: "admin", orgId });
  const tech = await prisma.user.create({
    data: { orgId, email: `${TAG}-tech@opero.test`, passwordHash: pw, name: "Tech", role: "technician", status: "active" },
  });
  techToken = signAccessToken({ sub: tech.id, role: "technician", orgId });
});

afterAll(async () => {
  await prisma.customer.deleteMany({ where: { OR: [{ name: { startsWith: TAG } }, { silvasoftId: { startsWith: TAG } }] } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("Silvasoft import — preview", () => {
  it("reports create/skip counts without writing", async () => {
    const buf = await buildWorkbook(sampleRows());
    const before = await prisma.customer.count({ where: { name: { startsWith: TAG } } });

    const res = await request(app)
      .post("/api/customers/import/preview")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");

    expect(res.status).toBe(200);
    expect(res.body.willCreate).toBe(3); // two businesses + one private
    expect(res.body.willUpdate).toBe(0);
    expect(res.body.skipped).toHaveLength(1); // the "Naam is niet bepaald" row
    expect(res.body.skipped[0].reason).toBe("no_name");

    // Nothing was written.
    expect(await prisma.customer.count({ where: { name: { startsWith: TAG } } })).toBe(before);
  });

  it("rejects a non-Silvasoft sheet (no Naam column)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["Foo", "Bar"]);
    ws.addRow(["a", "b"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const res = await request(app)
      .post("/api/customers/import/preview")
      .set(auth(adminToken))
      .attach("file", buf, "wrong.xlsx");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Naam/i);
  });

  it("is admin only", async () => {
    const buf = await buildWorkbook(sampleRows());
    const res = await request(app)
      .post("/api/customers/import/preview")
      .set(auth(techToken))
      .attach("file", buf, "customers.xlsx");
    expect(res.status).toBe(403);
  });
});

describe("Silvasoft import — commit", () => {
  it("creates customers, mapping type and registration numbers", async () => {
    const buf = await buildWorkbook(sampleRows());
    const res = await request(app)
      .post("/api/customers/import/commit")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: 3, updated: 0, skipped: 1 });

    const alpha = await prisma.customer.findFirst({ where: { orgId, silvasoftId: `${TAG}-1` } });
    expect(alpha).not.toBeNull();
    expect(alpha!.name).toBe(`${TAG} Alpha B.V.`);
    expect(alpha!.type).toBe("business");
    expect(alpha!.kvkNumber).toBe("12345678");
    expect(alpha!.vatNumber).toBe("NL0011B01");
    // Blank email/phone are allowed → stored empty, not rejected.
    expect(alpha!.email).toBe("");
    expect(alpha!.phone).toBe("");

    const klaas = await prisma.customer.findFirst({ where: { orgId, silvasoftId: `${TAG}-3` } });
    expect(klaas!.type).toBe("private");
    expect(klaas!.email).toBe("klaas@x.nl");
  });

  it("re-import matches on Silvasoft number: updates, does not duplicate", async () => {
    // Same numbers, but Alpha's name + a newly-filled email changed.
    const rows = sampleRows();
    rows[0][1] = `${TAG} Alpha Renamed B.V.`; // Naam
    rows[0][3] = "alpha@x.nl"; // E-mailadres (was blank)

    const buf = await buildWorkbook(rows);
    const res = await request(app)
      .post("/api/customers/import/commit")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");

    expect(res.status).toBe(200);
    // All three existing rows update; nothing new created.
    expect(res.body).toMatchObject({ created: 0, updated: 3 });

    // Exactly one Alpha still (no duplicate), with the new values.
    const alphas = await prisma.customer.findMany({ where: { orgId, silvasoftId: `${TAG}-1` } });
    expect(alphas).toHaveLength(1);
    expect(alphas[0].name).toBe(`${TAG} Alpha Renamed B.V.`);
    expect(alphas[0].email).toBe("alpha@x.nl");
  });

  it("numberless rows dedupe on name+address, not re-created every import", async () => {
    // A row with NO Nummer (Silvasoft's export contains these). It must match
    // itself on a second import instead of duplicating.
    const rows = [
      [null, `${TAG} Numberless B.V.`, null, null, "Mijlstraat 20", "5000 AA", "BOXTEL", "Bedrijf", null, null, null, 0],
    ];
    const buf = await buildWorkbook(rows);

    const first = await request(app)
      .post("/api/customers/import/commit")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");
    expect(first.body.created).toBe(1);

    const second = await request(app)
      .post("/api/customers/import/commit")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");
    // Second import updates the same row — does NOT create a duplicate.
    expect(second.body).toMatchObject({ created: 0, updated: 1 });

    const all = await prisma.customer.findMany({
      where: { orgId, name: `${TAG} Numberless B.V.` },
    });
    expect(all).toHaveLength(1);
  });

  it("the SAME file listing a customer twice (once numbered, once not) creates it once", async () => {
    // Mirrors the real export: Guts appears with number 113 AND with no number.
    const rows = [
      [`${TAG}-113`, `${TAG} Guts B.V.`, null, null, "Straat 9", "6000 BB", "EINDHOVEN", "Bedrijf", null, null, null, 0],
      [null, `${TAG} Guts B.V.`, null, null, "Straat 9", "6000 BB", "EINDHOVEN", "Bedrijf", null, null, null, 0],
    ];
    const buf = await buildWorkbook(rows);

    const res = await request(app)
      .post("/api/customers/import/commit")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");
    // The numbered row creates it; the numberless duplicate in the same file is
    // recognised as the same customer, not a second row.
    expect(res.body.created).toBe(1);

    const all = await prisma.customer.findMany({ where: { orgId, name: `${TAG} Guts B.V.` } });
    expect(all).toHaveLength(1);
  });

  it("re-import does NOT blank a field the export left empty", async () => {
    // Beta had an email in the original file; a later export with a blank email
    // must not wipe the stored one.
    const rows = sampleRows();
    rows[1][3] = null; // Beta E-mailadres now blank

    const buf = await buildWorkbook(rows);
    await request(app)
      .post("/api/customers/import/commit")
      .set(auth(adminToken))
      .attach("file", buf, "customers.xlsx");

    const beta = await prisma.customer.findFirst({ where: { orgId, silvasoftId: `${TAG}-2` } });
    // Still the value from the first import.
    expect(beta!.email).toBe("beta@x.nl");
  });
});
