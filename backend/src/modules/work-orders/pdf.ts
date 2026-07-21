import PDFDocument from "pdfkit";
import type { Organization } from "@prisma/client";
import { storage } from "../../lib/storage/index.js";

// Programmatic work-order (werkbon) PDF via pdfkit — no headless browser (per the
// project rule). Streams a document with the org header, customer/site block,
// tasks + their materials (prices only when `showPrices`), pre-job checklist,
// embedded photos, and the sign-off block with the drawn signature image.

// The shape the builder needs — a subset assembled by the route from the prisma
// aggregate. Keeps this module decoupled from Prisma includes.
export type WorkOrderPdfData = {
  number: string; // project number
  ordinal: number; // 0-based; printed as #N (1-based)
  title: string;
  status: string; // localized-ish label is fine; raw value acceptable
  createdAt: Date;
  customer: {
    name: string;
    contactName?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
  insulationType?: string;
  tasks: {
    description: string;
    workTypeName?: string;
    assigneeName?: string;
    done: boolean;
    hours?: number | null;
    materials: {
      name: string;
      quantity: number;
      unit: string;
      unitPrice?: number | null; // omitted/ignored when !showPrices
    }[];
    beforePhotos: string[]; // storage keys
    resultPhotos: string[];
  }[];
  prejobCheck: Record<string, boolean>;
  // Org's current item labels (key → label). Falls back to a humanized key for
  // any key not present (e.g. an item removed after this werkbon recorded it).
  prejobLabels: Record<string, string>;
  prejobPhotos: string[]; // storage keys
  dispatchedAt?: Date | null;
  signature?: string | null; // storage key of the drawn signature PNG
  signedByName?: string | null;
  signedAt?: Date | null;
};

const EURO = (n: number) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`;
const DATE = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// The werkbon is always a Dutch customer document, so labels are Dutch here
// (server-side; the client's i18next is not in scope). Mirrors the nl locale.
const STATUS_NL: Record<string, string> = {
  open: "Open",
  on_the_way: "Onderweg",
  urgent: "Spoed",
  done: "Afgerond",
};
const statusNl = (s: string) => STATUS_NL[s] ?? s;
// Label a checklist key: the org's configured label, else a humanized fallback
// (for a key stored before the org's current items, e.g. a removed item).
const prejobLabel = (k: string, labels: Record<string, string>) =>
  labels[k] ?? k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Fetch an image's bytes for embedding; returns null (and the caller skips it)
// if the object is missing or unreadable — a missing photo must never break the
// whole PDF.
async function safeRead(key: string): Promise<Buffer | null> {
  try {
    return await storage.read(key);
  } catch {
    return null;
  }
}

// Build the PDF and stream it into `out` (the Express response). Resolves when
// the document has been fully written.
export async function buildWorkOrderPdf(
  data: WorkOrderPdfData,
  opts: { showPrices: boolean; org: Organization },
  out: NodeJS.WritableStream,
): Promise<void> {
  const { showPrices, org } = opts;
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(out);

  // The content box. EVERYTHING flows top-to-bottom in this single column at x=LEFT
  // with width=CONTENT_W. We never mix absolute text(x,y) with flowing text (that
  // corrupts pdfkit's cursor) — the only exception is the material table row and
  // image rows, which fully manage their own x/y and restore doc.y afterwards.
  const LEFT = doc.page.margins.left;
  const CONTENT_W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const ACCENT = "#6750A4";
  const MUTED = "#6B7280";
  const INK = "#111827";
  const BODY = "#374151";

  // Reset flow to the left column at the current y — call before any flowing text
  // that follows an absolutely-positioned block, so x can never drift right.
  const flow = (opts?: PDFKit.Mixins.TextOptions) => ({ width: CONTENT_W, ...opts });
  const line = (
    text: string,
    o?: { color?: string; size?: number; bold?: boolean; gap?: number },
  ) => {
    doc.fillColor(o?.color ?? BODY).fontSize(o?.size ?? 9).font(o?.bold ? "Helvetica-Bold" : "Helvetica");
    doc.text(text, LEFT, doc.y, flow());
    if (o?.gap) doc.moveDown(o.gap);
  };

  // Pre-load every image we'll embed (parallel), so layout code stays sync.
  const imageCache = new Map<string, Buffer | null>();
  const keysToLoad = [
    ...(data.signature ? [data.signature] : []),
    ...data.prejobPhotos,
    ...data.tasks.flatMap((t) => [...t.beforePhotos, ...t.resultPhotos]),
  ];
  await Promise.all(
    [...new Set(keysToLoad)].map(async (k) => imageCache.set(k, await safeRead(k))),
  );
  const img = (key: string) => imageCache.get(key) ?? null;

  // --- Letterhead: sender (org) top-left; document meta top-right ---------
  const headTop = doc.y;
  // Sender block (left).
  doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text(org.name || "Werkbon", LEFT, headTop, { width: CONTENT_W * 0.6 });
  doc.fillColor(MUTED).fontSize(9).font("Helvetica");
  const senderLines: string[] = [
    org.address,
    [org.postalCode, org.city].filter(Boolean).join(" "),
    org.phone,
    org.email,
    org.vatNumber ? `BTW: ${org.vatNumber}` : "",
  ].filter((s): s is string => Boolean(s));
  for (const l of senderLines) {
    doc.text(l, { width: CONTENT_W * 0.6 });
  }
  const leftBottom = doc.y;

  // Document meta block (right): title + number/date/status, right-aligned.
  const metaX = LEFT + CONTENT_W * 0.55;
  const metaW = CONTENT_W * 0.45;
  doc.fillColor(ACCENT).fontSize(18).font("Helvetica-Bold").text("WERKBON", metaX, headTop, { width: metaW, align: "right" });
  doc.fillColor(INK).fontSize(10).font("Helvetica");
  doc.text(`${data.number} · #${data.ordinal + 1}`, metaX, doc.y, { width: metaW, align: "right" });
  doc.fillColor(MUTED).fontSize(9);
  doc.text(`Datum: ${DATE(data.createdAt)}`, metaX, doc.y, { width: metaW, align: "right" });
  doc.text(`Status: ${statusNl(data.status)}`, metaX, doc.y, { width: metaW, align: "right" });
  const rightBottom = doc.y;

  // Continue the single-column flow below whichever block is taller.
  doc.x = LEFT;
  doc.y = Math.max(leftBottom, rightBottom) + 12;
  hr(doc, LEFT, CONTENT_W);
  doc.moveDown(0.9);

  // --- Recipient (customer) — letter "Aan:" address block -----------------
  const c = data.customer;
  line("AAN", { color: MUTED, size: 8, bold: true, gap: 0.15 });
  line(c.name, { color: INK, size: 11, bold: true });
  if (c.contactName) line(`t.a.v. ${c.contactName}`, { color: BODY });
  const addr = [c.address, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (addr) line(addr, { color: BODY });
  doc.moveDown(0.8);

  // --- Subject / reference line (letter-style) ----------------------------
  const subjectBits = [
    data.title ? data.title : null,
    data.insulationType ? `Isolatie: ${data.insulationType}` : null,
  ].filter(Boolean);
  if (subjectBits.length > 0) {
    line(`Betreft: ${subjectBits.join(" · ")}`, { color: INK, bold: true });
    doc.moveDown(0.6);
  }

  // --- Tasks + materials --------------------------------------------------
  sectionTitle(doc, "Taken", LEFT, CONTENT_W);
  if (data.tasks.length === 0) line("Geen taken.", { color: MUTED });

  let grandTotal = 0;
  data.tasks.forEach((task, i) => {
    ensureSpace(doc, 70);
    line(`${i + 1}. ${task.description || "—"}${task.done ? "  (afgerond)" : ""}`, {
      color: INK, size: 11, bold: true,
    });
    const meta = [task.workTypeName, task.assigneeName, task.hours != null ? `${task.hours} u` : null]
      .filter(Boolean).join(" · ");
    if (meta) line(meta, { color: MUTED });

    if (task.materials.length > 0) {
      doc.moveDown(0.35);
      // Column x positions (absolute) for this task's material table.
      const cName = LEFT + 14;
      const cQty = showPrices ? LEFT + CONTENT_W * 0.5 : LEFT + CONTENT_W * 0.72;
      const wQty = showPrices ? CONTENT_W * 0.16 : CONTENT_W * 0.28;
      const cPrice = LEFT + CONTENT_W * 0.66;
      const cTotal = LEFT + CONTENT_W * 0.83;
      const wPrice = CONTENT_W * 0.17;

      // Column header row (Dutch).
      ensureSpace(doc, 16);
      const hy = doc.y;
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
      doc.text("Materiaal", cName, hy, { width: (cQty - cName) - 6 });
      doc.text("Aantal", cQty, hy, { width: wQty, align: "right" });
      if (showPrices) {
        doc.text("Prijs", cPrice, hy, { width: wPrice, align: "right" });
        doc.text("Totaal", cTotal, hy, { width: LEFT + CONTENT_W - cTotal, align: "right" });
      }
      doc.y = hy + 13;
      doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(cName, doc.y).lineTo(LEFT + CONTENT_W, doc.y).stroke();
      doc.y += 4;

      task.materials.forEach((m) => {
        ensureSpace(doc, 16);
        const qty = `${m.quantity} ${m.unit}`.trim();
        const lineTotal = showPrices && m.unitPrice != null ? m.quantity * m.unitPrice : null;
        if (lineTotal != null) grandTotal += lineTotal;
        const y = doc.y;
        doc.fillColor(BODY).fontSize(9).font("Helvetica");
        doc.text(m.name, cName, y, { width: (cQty - cName) - 6, lineBreak: false, ellipsis: true });
        doc.text(qty, cQty, y, { width: wQty, align: "right" });
        if (showPrices) {
          doc.text(m.unitPrice != null ? EURO(m.unitPrice) : "—", cPrice, y, { width: wPrice, align: "right" });
          doc.text(lineTotal != null ? EURO(lineTotal) : "—", cTotal, y, {
            width: LEFT + CONTENT_W - cTotal, align: "right",
          });
        }
        doc.y = y + 14; // advance one row; restores the single-column cursor
      });
    }

    const photos = [...task.beforePhotos, ...task.resultPhotos].map(img).filter((b): b is Buffer => b != null);
    if (photos.length > 0) imageRow(doc, photos, LEFT, CONTENT_W);

    doc.moveDown(0.7);
  });

  if (showPrices && grandTotal > 0) {
    ensureSpace(doc, 34);
    hr(doc, LEFT, CONTENT_W);
    doc.moveDown(0.3);
    doc.fillColor(INK).fontSize(11).font("Helvetica-Bold")
      .text(`Totaal: ${EURO(grandTotal)}`, LEFT, doc.y, flow({ align: "right" }));
    doc.moveDown(0.6);
  }

  // --- Pre-job checklist --------------------------------------------------
  const checkKeys = Object.keys(data.prejobCheck);
  if (checkKeys.length > 0) {
    ensureSpace(doc, 50);
    sectionTitle(doc, "Controle vooraf", LEFT, CONTENT_W);
    for (const k of checkKeys) {
      line(`${data.prejobCheck[k] ? "[x]" : "[ ]"}  ${prejobLabel(k, data.prejobLabels)}`, { color: BODY });
    }
    if (data.dispatchedAt) line(`Verzonden: ${DATE(data.dispatchedAt)}`, { color: MUTED });
    const pj = data.prejobPhotos.map(img).filter((b): b is Buffer => b != null);
    if (pj.length > 0) imageRow(doc, pj, LEFT, CONTENT_W);
    doc.moveDown(0.9);
  }

  // --- Sign-off -----------------------------------------------------------
  ensureSpace(doc, 130);
  hr(doc, LEFT, CONTENT_W);
  doc.moveDown(0.6);
  sectionTitle(doc, "Ondertekening", LEFT, CONTENT_W);
  if (data.signedByName || data.signature) {
    if (data.signedByName) line(`Naam: ${data.signedByName}`, { color: BODY });
    if (data.signedAt) line(`Datum: ${DATE(data.signedAt)}`, { color: BODY });
    const sig = data.signature ? img(data.signature) : null;
    if (sig) {
      doc.moveDown(0.3);
      try {
        doc.image(sig, LEFT, doc.y, { fit: [200, 80] });
        doc.y += 84;
      } catch {
        /* corrupt image → skip, keep the name/date */
      }
    }
  } else {
    line("Nog niet ondertekend.", { color: MUTED });
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

// --- small layout helpers --------------------------------------------------

function hr(doc: PDFKit.PDFDocument, left: number, width: number) {
  doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
}

// Section label — ALWAYS anchored at the left column x, so it can never inherit
// a drifted x from a preceding absolutely-positioned block.
function sectionTitle(doc: PDFKit.PDFDocument, text: string, left: number, width: number) {
  doc.fillColor("#6750A4").fontSize(8).font("Helvetica-Bold")
    .text(text.toUpperCase(), left, doc.y, { width, characterSpacing: 1 });
  doc.moveDown(0.25);
}

// Break to a new page if fewer than `needed` points remain.
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

// A horizontal row of small thumbnails (bounded to one row). Restores the flow
// cursor to `left` afterwards so following text stays in the single column.
function imageRow(doc: PDFKit.PDFDocument, images: Buffer[], left: number, width: number) {
  const size = 84;
  const gap = 8;
  const perRow = Math.max(1, Math.floor((width + gap) / (size + gap)));
  const shown = images.slice(0, perRow);
  ensureSpace(doc, size + 8);
  const y = doc.y + 4;
  shown.forEach((buf, i) => {
    const x = left + i * (size + gap);
    try {
      doc.image(buf, x, y, { fit: [size, size] });
    } catch {
      /* skip a corrupt image */
    }
  });
  doc.x = left;
  doc.y = y + size + 8;
}
