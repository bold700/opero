import PDFDocument from "pdfkit";
import type { Organization } from "@prisma/client";
import { storage } from "../../lib/storage/index.js";

// Programmatic work-order (werkbon) PDF via pdfkit — no headless browser (per the
// project rule). Streams a document with the org header, customer/site block,
// tasks + their materials (NO prices — see below), pre-job checklist,
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
    // Who to call from site, and their email. The werkbon is printed and taken
    // to the job, so the contact details have to be ON it — an app-only
    // tel: link is no use to someone holding a sheet of paper.
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
  insulationType?: string;
  // The planned visit — date(s) "YYYY-MM-DD" plus the slot's times ("08:00"),
  // so the printed werkbon says when the crew is expected, not just when the
  // document was made.
  plannedDate?: string;
  plannedEndDate?: string;
  startTime?: string;
  endTime?: string;
  // What this job is about, in prose — the werkbon's OWN description when it
  // has one, else the project's (resolved by the route). Printed between the
  // recipient block and the task list; the numbered task list below stays the
  // per-zone breakdown, not the job description.
  jobDescription?: string;
  tasks: {
    /** The zone's short title — printed as the numbered task line. */
    description: string;
    /**
     * The zone's WORK DESCRIPTION ("Werkomschrijving" in the app) — what has to
     * happen in this zone, in prose. This is the field the office actually
     * types into, and it was missing from the printed werkbon entirely.
     */
    note?: string | null;
    workTypeName?: string;
    assigneeName?: string;
    done: boolean;
    materials: {
      name: string;
      quantity: number;
      unit: string;
      // No unitPrice — the werkbon carries no money (see buildWorkOrderPdf).
      // Meerwerk is still MARKED, with whether it's been agreed: on site it
      // matters that a line is extra work and whether it's signed off, even
      // though the amount isn't shown here.
      isExtraWork?: boolean;
      approvedByOffice?: boolean;
      approvedByClient?: boolean;
      rejected?: boolean;
    }[];
    beforePhotos: string[]; // storage keys
    resultPhotos: string[];
  }[];
  prejobCheck: Record<string, boolean>;
  // Org's current item labels (key → label). Falls back to a humanized key for
  // any key not present (e.g. an item removed after this werkbon recorded it).
  prejobLabels: Record<string, string>;
  prejobPhotos: string[]; // storage keys
  // Drawings and documents attached to the werkbon. Image attachments are
  // embedded as full-width pages so a monteur working from paper HAS the
  // drawing; PDF attachments cannot be merged by pdfkit, so those are listed by
  // name instead of silently dropped.
  attachments?: {
    key: string;
    filename: string;
    contentType: string;
  }[];
  dispatchedAt?: Date | null;
  signature?: string | null; // storage key of the drawn signature PNG
  signedByName?: string | null;
  signedAt?: Date | null;
};

const DATE = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

// The werkbon is always a Dutch customer document, so labels are Dutch here
// (server-side; the client's i18next is not in scope). Mirrors the nl locale.
const STATUS_NL: Record<string, string> = {
  open: "Open",
  planned: "Gepland",
  released: "Vrijgegeven",
  in_progress: "In uitvoering",
  ready_for_review: "Klaar voor controle",
  approved: "Goedgekeurd",
  ready_to_invoice: "Klaar voor facturatie",
  invoiced: "Gefactureerd",
  completed: "Afgerond",
};
const statusNl = (s: string) => STATUS_NL[s] ?? s;

// Field/section labels, keyed in ENGLISH and rendered to Dutch here (the same
// rule as the client's i18n: identifiers stay English, Dutch is display-only).
const LABEL_NL = {
  subject: "Betreft",
  planned: "Gepland",
  jobDescription: "Omschrijving",
  phone: "Tel",
  email: "E-mail",
  documents: "Documenten",
  imageUnavailable: "Afbeelding kon niet worden weergegeven.",
} as const;
const label = (key: keyof typeof LABEL_NL) => LABEL_NL[key];
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
  opts: { org: Organization },
  out: NodeJS.WritableStream,
): Promise<void> {
  const { org } = opts;
  // The WERKBON CARRIES NO PRICES — for any role. It's the record of what was
  // done on site (quantities, photos, signature); the money lives on the
  // offerte (quote-pdf.ts) and the invoice.
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
  // Only IMAGE attachments are fetched: a PDF attachment cannot be drawn onto
  // the page, so pulling its bytes would be wasted I/O.
  const imageAttachments = (data.attachments ?? []).filter((a) =>
    a.contentType.startsWith("image/"),
  );
  const keysToLoad = [
    ...(org.logo ? [org.logo] : []),
    ...(data.signature ? [data.signature] : []),
    ...data.prejobPhotos,
    ...data.tasks.flatMap((t) => [...t.beforePhotos, ...t.resultPhotos]),
    ...imageAttachments.map((a) => a.key),
  ];
  await Promise.all(
    [...new Set(keysToLoad)].map(async (k) => imageCache.set(k, await safeRead(k))),
  );
  const img = (key: string) => imageCache.get(key) ?? null;

  // --- Letterhead: sender (org) top-left; document meta top-right ---------
  const headTop = doc.y;
  // Sender block (left).
  const logo = org.logo ? img(org.logo) : null;
  if (logo) {
    try {
      doc.image(logo, LEFT, headTop, { fit: [150, 54], valign: "center" });
      doc.y = headTop + 60;
      doc.fillColor(INK).fontSize(10).font("Helvetica-Bold").text(org.name, LEFT, doc.y, { width: CONTENT_W * 0.5 });
    } catch {
      doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text(org.name || "Werkbon", LEFT, headTop, { width: CONTENT_W * 0.5 });
    }
  } else {
    doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text(org.name || "Werkbon", LEFT, headTop, { width: CONTENT_W * 0.5 });
  }
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
  // The planned visit: single day or range, with the slot's times when set.
  if (data.plannedDate) {
    const span = data.plannedEndDate
      ? `${DATE(new Date(data.plannedDate))} – ${DATE(new Date(data.plannedEndDate))}`
      : DATE(new Date(data.plannedDate));
    const times =
      data.startTime && data.endTime ? ` · ${data.startTime}–${data.endTime}` : "";
    doc.text(`${label("planned")}: ${span}${times}`, metaX, doc.y, { width: metaW, align: "right" });
  }
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
  // Contact details for the crew on site. Printed under the address so the
  // whole "who and where" block stays together.
  if (c.contactPhone) line(`${label("phone")}: ${c.contactPhone}`, { color: BODY });
  if (c.contactEmail) line(`${label("email")}: ${c.contactEmail}`, { color: BODY });
  doc.moveDown(0.8);

  // --- Subject / reference line (letter-style) ----------------------------
  const subjectBits = [
    data.title ? data.title : null,
    data.insulationType ? `Isolatie: ${data.insulationType}` : null,
  ].filter(Boolean);
  if (subjectBits.length > 0) {
    line(`${label("subject")}: ${subjectBits.join(" · ")}`, { color: INK, bold: true });
    doc.moveDown(0.6);
  }

  // --- Job description ----------------------------------------------------
  // The prose that says what this visit is for ("2e verdieping, week 38"). The
  // route resolves it: the werkbon's own description, else the project's. This
  // is the whole-job statement; the numbered task list below is the per-zone
  // breakdown, so both belong on the document.
  if (data.jobDescription) {
    ensureSpace(doc, 40);
    sectionTitle(doc, label("jobDescription"), LEFT, CONTENT_W);
    line(data.jobDescription, { color: BODY });
    doc.moveDown(0.8);
  }

  // --- Tasks + materials --------------------------------------------------
  sectionTitle(doc, "Taken", LEFT, CONTENT_W);
  if (data.tasks.length === 0) line("Geen taken.", { color: MUTED });

  data.tasks.forEach((task, i) => {
    ensureSpace(doc, 70);
    line(`${i + 1}. ${task.description || "—"}${task.done ? "  (afgerond)" : ""}`, {
      color: INK, size: 11, bold: true,
    });
    // The zone's work description, in the office's own words. Printed directly
    // under its title: this is what the monteur is actually meant to DO here,
    // so a werkbon without it is missing the instruction it exists to carry.
    const workDescription = task.note?.trim();
    if (workDescription) line(workDescription, { color: BODY });
    const meta = [task.workTypeName, task.assigneeName].filter(Boolean).join(" · ");
    if (meta) line(meta, { color: MUTED });

    const renderMaterialTable = (
      heading: string,
      materials: typeof task.materials,
      extraWork: boolean,
    ) => {
      if (materials.length === 0) return;
      doc.moveDown(0.35);
      // Column x positions (absolute) for this task's material table.
      const cName = LEFT + 14;
      const cQty = LEFT + CONTENT_W * 0.72;
      const wQty = CONTENT_W * 0.28;

      // Column header row (Dutch).
      ensureSpace(doc, 30);
      doc.fillColor(INK).fontSize(8).font("Helvetica-Bold").text(heading, cName, doc.y, {
        width: CONTENT_W - 14,
      });
      doc.moveDown(0.2);
      const hy = doc.y;
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
      doc.text(extraWork ? "Omschrijving" : "Materiaal", cName, hy, { width: (cQty - cName) - 6 });
      doc.text("Aantal", cQty, hy, { width: wQty, align: "right" });
      doc.y = hy + 13;
      doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(cName, doc.y).lineTo(LEFT + CONTENT_W, doc.y).stroke();
      doc.y += 4;

      materials.forEach((m) => {
        ensureSpace(doc, 16);
        const qty = `${m.quantity} ${m.unit}`.trim();
        const agreed =
          m.approvedByOffice === true && m.approvedByClient === true && m.rejected !== true;
        const rowLabel = extraWork
          ? `${m.name}  (${agreed ? "akkoord" : "wacht op akkoord"})`
          : m.name;
        const y = doc.y;
        doc.fillColor(BODY).fontSize(9).font("Helvetica");
        doc.text(rowLabel, cName, y, { width: (cQty - cName) - 6, lineBreak: false, ellipsis: true });
        doc.text(qty, cQty, y, { width: wQty, align: "right" });
        doc.y = y + 14; // advance one row; restores the single-column cursor
      });
    };

    const visibleMaterials = task.materials.filter((material) => material.rejected !== true);
    renderMaterialTable(
      "Materialen",
      visibleMaterials.filter((material) => !material.isExtraWork),
      false,
    );
    renderMaterialTable(
      "Extra werkzaamheden",
      visibleMaterials.filter((material) => material.isExtraWork),
      true,
    );

    const photos = [...task.beforePhotos, ...task.resultPhotos].map(img).filter((b): b is Buffer => b != null);
    if (photos.length > 0) imageRow(doc, photos, LEFT, CONTENT_W);

    doc.moveDown(0.7);
  });

  // No totals block: the werkbon states what was done, not what it costs.

  // --- Pre-job checklist --------------------------------------------------
  const checkKeys = Object.keys(data.prejobCheck);
  if (checkKeys.length > 0) {
    ensureSpace(doc, 50);
    sectionTitle(doc, "Controle vooraf", LEFT, CONTENT_W);
    for (const k of checkKeys) {
      line(`${data.prejobCheck[k] ? "[x]" : "[ ]"}  ${prejobLabel(k, data.prejobLabels)}`, { color: BODY });
    }
    if (data.dispatchedAt) line(`Vrijgegeven: ${DATE(data.dispatchedAt)}`, { color: MUTED });
    const pj = data.prejobPhotos.map(img).filter((b): b is Buffer => b != null);
    if (pj.length > 0) imageRow(doc, pj, LEFT, CONTENT_W);
    doc.moveDown(0.9);
  }

  // --- Drawings & documents ------------------------------------------------
  // The whole point of printing these: a monteur working from paper needs the
  // tekening in his hand, not a link in an app he may not have open on site.
  //
  // Images are embedded full width, one per page, so a drawing is actually
  // legible. A PDF attachment cannot be merged in by pdfkit, so it is named
  // here instead: the name is all a non-image document has to identify it, and
  // saying "there is another document" beats dropping it silently and letting
  // someone sign off believing the sheet is complete.
  const allAttachments = data.attachments ?? [];
  if (allAttachments.length > 0) {
    const pdfAttachments = allAttachments.filter((a) => !a.contentType.startsWith("image/"));

    if (pdfAttachments.length > 0) {
      ensureSpace(doc, 60);
      hr(doc, LEFT, CONTENT_W);
      doc.moveDown(0.6);
      sectionTitle(doc, label("documents"), LEFT, CONTENT_W);
      for (const a of pdfAttachments) {
        line(`• ${a.filename}`, { color: BODY });
      }
      doc.moveDown(0.6);
    }

  }

  // --- Sign-off -----------------------------------------------------------
  ensureSpace(doc, 130);
  hr(doc, LEFT, CONTENT_W);
  doc.moveDown(0.6);
  sectionTitle(doc, "Afronding en ondertekening", LEFT, CONTENT_W);
  line(
    "De ondertekenaar bevestigt dat de hierboven vermelde werkzaamheden en materialen zijn uitgevoerd en geregistreerd.",
    { color: BODY },
  );
  doc.moveDown(0.35);
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

  // --- Attached image pages (annex) ---------------------------------------
  // AFTER the sign-off on purpose: the signature closes the werkbon itself, so
  // it must stay with the job content rather than being pushed behind a stack
  // of images. Each one then gets a full page, which is the only way it is
  // actually readable on paper.
  //
  // No heading and no filename. These are whatever the office attached — a
  // tekening, a scan, a photo of a meter — so labelling every page "TEKENING"
  // would be wrong for most of them, and the picture speaks for itself anyway.
  for (const a of imageAttachments) {
    const buf = img(a.key);
    if (!buf) continue; // unreadable object — never break the whole PDF
    doc.addPage();
    const top = doc.y;
    const availH = doc.page.height - doc.page.margins.bottom - top;
    try {
      doc.image(buf, LEFT, top, { fit: [CONTENT_W, availH], align: "center" });
    } catch {
      // Corrupt/unsupported image: say so rather than leaving a blank page.
      line(label("imageUnavailable"), { color: MUTED });
    }
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
