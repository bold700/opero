import PDFDocument from "pdfkit";
import type { Organization } from "@prisma/client";

// Customer-facing quote (offerte) PDF for a work order — mirrors the org's
// existing paper offerte: letterhead with company/bank details, quote
// number/date/expiry, customer block, underlined subject, task-grouped line
// tables (quantity | unit | description | price | total) and a VAT total block.
// pdfkit, no headless browser (project rule). Admin-only route; prices always
// shown. Same single-column cursor discipline as pdf.ts.

export type QuotePdfData = {
  quoteNumber: string;
  quoteDate: Date;
  expiryDate: Date;
  title: string; // werkbon title → underlined subject line
  customer: {
    name: string;
    contactName?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
  // One group per work-order task: heading + its priced lines.
  groups: {
    heading: string;
    lines: {
      quantity: number;
      unit: string;
      name: string;
      unitPrice?: number | null;
    }[];
  }[];
};

// Dutch VAT rate for the totals block.
const VAT_RATE = 0.21;

const EURO = (n: number) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const QTY = (n: number) => n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE = (d: Date) => d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });

// Display labels — ENGLISH KEYS, Dutch display strings (offerte is a Dutch
// customer document; same pattern as pdf.ts STATUS_NL). Never inline Dutch
// prose elsewhere in this module.
const LABELS_NL = {
  documentTitle: "Offerte",
  phone: "Tel.",
  email: "E-mail",
  website: "Website",
  iban: "IBAN",
  bic: "BIC",
  vatNumber: "Btw-nummer",
  kvkNumber: "KVK-nummer",
  quoteNumber: "Offerte nummer",
  quoteDate: "Offerte datum",
  expiryDate: "Offerte verval datum",
  attn: "t.a.v.",
  quantity: "Aantal",
  unit: "Eenheid",
  description: "Omschrijving",
  price: "Prijs",
  total: "Totaal",
  subtotal: "Subtotaal",
  vat: "BTW 21%",
  grandTotal: "Totaal",
} as const;

export async function buildQuotePdf(
  data: QuotePdfData,
  opts: { org: Organization },
  out: NodeJS.WritableStream,
): Promise<void> {
  const { org } = opts;
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(out);

  const LEFT = doc.page.margins.left;
  const CONTENT_W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const MUTED = "#6B7280";
  const INK = "#111827";
  const BODY = "#374151";

  const flow = (o?: PDFKit.Mixins.TextOptions) => ({ width: CONTENT_W, ...o });
  const line = (
    text: string,
    o?: { color?: string; size?: number; bold?: boolean; gap?: number },
  ) => {
    doc.fillColor(o?.color ?? BODY).fontSize(o?.size ?? 9).font(o?.bold ? "Helvetica-Bold" : "Helvetica");
    doc.text(text, LEFT, doc.y, flow());
    if (o?.gap) doc.moveDown(o.gap);
  };

  // --- Letterhead: org name left, contact/bank details right ---------------
  const headTop = doc.y;
  doc.fillColor(INK).fontSize(18).font("Helvetica-Bold").text(org.name, LEFT, headTop, { width: CONTENT_W * 0.5 });
  const leftBottom = doc.y;

  const metaX = LEFT + CONTENT_W * 0.5;
  const metaW = CONTENT_W * 0.5;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica");
  const contactLines: [string, string | null][] = [
    [LABELS_NL.phone, org.phone],
    [LABELS_NL.email, org.email],
    [LABELS_NL.website, org.website],
    [LABELS_NL.iban, org.iban],
    [LABELS_NL.bic, org.bic],
    [LABELS_NL.vatNumber, org.vatNumber],
    [LABELS_NL.kvkNumber, org.kvkNumber],
  ];
  let my = headTop;
  for (const [label, value] of contactLines) {
    if (!value) continue;
    doc.font("Helvetica-Bold").fillColor(INK).text(`${label}: `, metaX, my, { width: metaW, continued: true });
    doc.font("Helvetica").fillColor(BODY).text(value);
    my = doc.y;
  }
  const rightBottom = doc.y;

  doc.x = LEFT;
  doc.y = Math.max(leftBottom, rightBottom) + 20;

  // --- Document title + customer block -------------------------------------
  line(LABELS_NL.documentTitle, { color: INK, size: 15, bold: true, gap: 0.6 });
  const c = data.customer;
  line(c.name, { color: INK, size: 10, bold: true });
  if (c.contactName) line(`${LABELS_NL.attn} ${c.contactName}`);
  if (c.address) line(c.address);
  const postal = [c.postalCode, c.city].filter(Boolean).join(" ");
  if (postal) line(postal);
  doc.moveDown(1.2);

  // --- Quote meta (number / date / expiry), right-aligned label:value ------
  const qmX = LEFT + CONTENT_W * 0.5;
  const qmLabelW = CONTENT_W * 0.3;
  const qmValueW = CONTENT_W * 0.2;
  const metaRows: [string, string][] = [
    [LABELS_NL.quoteNumber, data.quoteNumber],
    [LABELS_NL.quoteDate, DATE(data.quoteDate)],
    [LABELS_NL.expiryDate, DATE(data.expiryDate)],
  ];
  for (const [label, value] of metaRows) {
    const y = doc.y;
    doc.fillColor(BODY).fontSize(9).font("Helvetica").text(label, qmX, y, { width: qmLabelW });
    doc.fillColor(INK).font("Helvetica-Bold").text(value, qmX + qmLabelW, y, { width: qmValueW, align: "right" });
    doc.y = y + 13;
  }
  doc.x = LEFT;
  doc.moveDown(1);

  // --- Line table header -----------------------------------------------------
  // Columns follow the source offerte: Aantal | Eenheid | Omschrijving | Prijs | Totaal.
  const cQty = LEFT;
  const wQty = CONTENT_W * 0.08;
  const cUnit = LEFT + CONTENT_W * 0.09;
  const wUnit = CONTENT_W * 0.1;
  const cName = LEFT + CONTENT_W * 0.2;
  const wName = CONTENT_W * 0.44;
  const cPrice = LEFT + CONTENT_W * 0.65;
  const wPrice = CONTENT_W * 0.15;
  const cTotal = LEFT + CONTENT_W * 0.81;
  const wTotal = CONTENT_W * 0.19;

  const headerRow = () => {
    const y = doc.y;
    doc.fillColor(INK).fontSize(8).font("Helvetica-Bold");
    doc.text(LABELS_NL.quantity, cQty, y, { width: wQty });
    doc.text(LABELS_NL.unit, cUnit, y, { width: wUnit });
    doc.text(LABELS_NL.description, cName, y, { width: wName });
    doc.text(LABELS_NL.price, cPrice, y, { width: wPrice, align: "right" });
    doc.text(LABELS_NL.total, cTotal, y, { width: wTotal, align: "right" });
    doc.y = y + 12;
    doc.strokeColor("#111827").lineWidth(0.8).moveTo(LEFT, doc.y).lineTo(LEFT + CONTENT_W, doc.y).stroke();
    doc.y += 8;
    doc.x = LEFT;
  };
  headerRow();

  // --- Subject (underlined, like the source offerte) -----------------------
  if (data.title) {
    ensureSpace(doc, 24);
    const y = doc.y;
    doc.fillColor(INK).fontSize(9).font("Helvetica-Bold").text(data.title, LEFT, y, { width: CONTENT_W, underline: true });
    doc.moveDown(0.8);
    doc.x = LEFT;
  }

  // --- Groups (one per task) ------------------------------------------------
  let subtotal = 0;
  for (const group of data.groups) {
    if (group.lines.length === 0) continue;
    ensureSpace(doc, 44);
    line(group.heading, { color: INK, size: 9.5, bold: true, gap: 0.4 });

    for (const l of group.lines) {
      ensureSpace(doc, 16);
      const y = doc.y;
      const lineTotal = l.unitPrice != null ? l.quantity * l.unitPrice : null;
      if (lineTotal != null) subtotal += lineTotal;
      doc.fillColor(BODY).fontSize(9).font("Helvetica");
      doc.text(QTY(l.quantity), cQty, y, { width: wQty, align: "right" });
      doc.text(l.unit, cUnit, y, { width: wUnit });
      doc.text(l.name, cName, y, { width: wName, lineBreak: false, ellipsis: true });
      doc.text(l.unitPrice != null ? EURO(l.unitPrice) : "—", cPrice, y, { width: wPrice, align: "right" });
      doc.text(lineTotal != null ? EURO(lineTotal) : "—", cTotal, y, { width: wTotal, align: "right" });
      doc.y = y + 14;
    }
    doc.x = LEFT;
    doc.moveDown(0.7);
  }

  // --- Totals block: subtotal, VAT, grand total -----------------------------
  ensureSpace(doc, 60);
  doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(LEFT, doc.y).lineTo(LEFT + CONTENT_W, doc.y).stroke();
  doc.moveDown(0.5);
  const vat = subtotal * VAT_RATE;
  const totals: [string, string, boolean][] = [
    [LABELS_NL.subtotal, EURO(subtotal), false],
    [LABELS_NL.vat, EURO(vat), false],
    [LABELS_NL.grandTotal, EURO(subtotal + vat), true],
  ];
  for (const [label, value, bold] of totals) {
    const y = doc.y;
    doc.fillColor(bold ? INK : BODY).fontSize(bold ? 10.5 : 9).font(bold ? "Helvetica-Bold" : "Helvetica");
    doc.text(label, cPrice, y, { width: wPrice, align: "right" });
    doc.text(value, cTotal, y, { width: wTotal, align: "right" });
    doc.y = y + (bold ? 17 : 14);
  }
  doc.x = LEFT;

  doc.end();
  await new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

// Break to a new page if fewer than `needed` points remain (same as pdf.ts).
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}
