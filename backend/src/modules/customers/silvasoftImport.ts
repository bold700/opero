import ExcelJS from "exceljs";

// Parse + map a Silvasoft "Export → Excel" customer file.
//
// The export is one sheet with a header row of Dutch column names. Only a
// handful of columns matter to Opero; the rest (payment terms, Peppol, sales
// rep…) are ignored. Real files are messy — this module is written around the
// actual export the client provided:
//   - email/phone are almost always blank (5/75 and 2/75) → allowed empty
//   - Type is "Bedrijf" or "Particulier" → business / private
//   - a "Naam is niet bepaald" placeholder means the name was never set → skip
//   - "Nummer" is Silvasoft's id, kept for dedupe on re-import
//   - KvK-nummer / BTW-nummer are carried across for the KvK-check feature

// The header labels we read, mapped to a stable internal key. Matching is
// case-insensitive and trims whitespace so minor export changes don't break it.
const COLUMN_MAP: Record<string, string> = {
  nummer: "silvasoftId",
  naam: "name",
  telefoon: "phone",
  "e-mailadres": "email",
  adres: "address",
  postcode: "postalCode",
  plaats: "city",
  type: "type",
  "kvk-nummer": "kvkNumber",
  "btw-nummer": "vatNumber",
  contactpersoon: "contactName",
};

// A sentinel Silvasoft writes when a customer has no name set.
const NAME_NOT_SET = "naam is niet bepaald";

export type ParsedCustomer = {
  silvasoftId: string | null;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  type: "business" | "private";
  kvkNumber: string | null;
  vatNumber: string | null;
};

export type SkippedRow = {
  // 1-based row number in the sheet (including the header), for the UI to cite.
  row: number;
  reason: "no_name";
  raw: string;
};

export type ParseResult = {
  customers: ParsedCustomer[];
  skipped: SkippedRow[];
  // Header labels we didn't recognise — surfaced so an unexpected export shape
  // is visible rather than silently dropping data.
  unmappedColumns: string[];
};

function str(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    // ExcelJS rich text / hyperlink / formula result objects.
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v && v.result != null) return String(v.result).trim();
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("").trim();
    }
    return "";
  }
  return String(v).trim();
}

function mapType(raw: string): "business" | "private" {
  // "Particulier" → private; everything else (incl. "Bedrijf") → business,
  // the safer default since business is the common case here.
  return raw.trim().toLowerCase() === "particulier" ? "private" : "business";
}

export async function parseSilvasoftCustomers(buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The file has no worksheets");

  // Header row → column index (1-based, ExcelJS convention) per internal key.
  const headerRow = ws.getRow(1);
  const colIndex: Partial<Record<string, number>> = {};
  const unmappedColumns: string[] = [];
  headerRow.eachCell((cell, col) => {
    const label = str(cell.value).toLowerCase();
    if (!label) return;
    const key = COLUMN_MAP[label];
    if (key) colIndex[key] = col;
    else unmappedColumns.push(str(cell.value));
  });

  if (colIndex.name === undefined) {
    throw new Error(
      'This does not look like a Silvasoft customer export — no "Naam" column found.',
    );
  }

  const get = (row: ExcelJS.Row, key: string): string => {
    const idx = colIndex[key];
    return idx ? str(row.getCell(idx).value) : "";
  };

  const customers: ParsedCustomer[] = [];
  const skipped: SkippedRow[] = [];

  // Data rows start at 2 (row 1 is the header).
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const rawName = get(row, "name");
    const name = rawName.trim();

    // Empty spacer row → ignore silently (not a skip worth reporting).
    const anyData = ["name", "address", "city", "email", "silvasoftId"].some(
      (k) => get(row, k),
    );
    if (!anyData) continue;

    if (!name || name.toLowerCase() === NAME_NOT_SET) {
      skipped.push({
        row: r,
        reason: "no_name",
        raw: [get(row, "address"), get(row, "city")].filter(Boolean).join(", ") || "—",
      });
      continue;
    }

    const contactName = get(row, "contactName");
    customers.push({
      silvasoftId: get(row, "silvasoftId") || null,
      name,
      // The export's contactpersoon is usually blank or the "not set"
      // sentinel; fall back to empty rather than importing the sentinel.
      contactName:
        contactName && contactName.toLowerCase() !== NAME_NOT_SET ? contactName : "",
      email: get(row, "email"),
      phone: get(row, "phone"),
      address: get(row, "address"),
      postalCode: get(row, "postalCode"),
      city: get(row, "city"),
      type: mapType(get(row, "type")),
      kvkNumber: get(row, "kvkNumber") || null,
      vatNumber: get(row, "vatNumber") || null,
    });
  }

  return { customers, skipped, unmappedColumns };
}
