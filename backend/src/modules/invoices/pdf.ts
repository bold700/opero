import PDFDocument from "pdfkit";
import type { Organization } from "@prisma/client";
import { storage } from "../../lib/storage/index.js";

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  reference: string;
  quoteNumber?: string;
  customer: {
    name: string;
    contactName?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  };
  acceptedQuoteAmount: number;
  extraWork: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }[];
};

const VAT_RATE = 0.21;
const money = (value: number) =>
  `€ ${value.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quantity = (value: number) =>
  value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
const date = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export async function buildInvoicePdf(
  data: InvoicePdfData,
  opts: { org: Organization },
  out: NodeJS.WritableStream,
): Promise<void> {
  const { org } = opts;
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(out);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const accent = "#6750A4";
  const ink = "#111827";
  const body = "#374151";
  const muted = "#6B7280";
  const hairline = "#E5E7EB";

  const write = (
    value: string,
    options: { color?: string; size?: number; bold?: boolean; gap?: number } = {},
  ) => {
    doc
      .fillColor(options.color ?? body)
      .fontSize(options.size ?? 9)
      .font(options.bold ? "Helvetica-Bold" : "Helvetica")
      .text(value, left, doc.y, { width });
    if (options.gap) doc.moveDown(options.gap);
  };

  let logo: Buffer | null = null;
  if (org.logo) {
    try {
      logo = await storage.read(org.logo);
    } catch {
      logo = null;
    }
  }

  const top = doc.y;
  if (logo) {
    try {
      doc.image(logo, left, top, { fit: [150, 54], valign: "center" });
      doc.y = top + 60;
      doc.fillColor(ink).fontSize(10).font("Helvetica-Bold").text(org.name, left, doc.y, { width: width * 0.48 });
    } catch {
      doc.fillColor(ink).fontSize(18).font("Helvetica-Bold").text(org.name, left, top, { width: width * 0.48 });
    }
  } else {
    doc.fillColor(ink).fontSize(18).font("Helvetica-Bold").text(org.name, left, top, { width: width * 0.48 });
  }
  doc.fillColor(muted).fontSize(8.5).font("Helvetica");
  for (const value of [
    org.address,
    [org.postalCode, org.city].filter(Boolean).join(" "),
    org.email,
    org.phone,
  ].filter((item): item is string => Boolean(item))) {
    doc.text(value, left, doc.y, { width: width * 0.48 });
  }
  const senderBottom = doc.y;

  const metaX = left + width * 0.55;
  const metaWidth = width * 0.45;
  doc.fillColor(accent).fontSize(22).font("Helvetica-Bold").text("FACTUUR", metaX, top, {
    width: metaWidth,
    align: "right",
  });
  doc.fillColor(ink).fontSize(10).font("Helvetica-Bold").text(data.invoiceNumber, metaX, doc.y, {
    width: metaWidth,
    align: "right",
  });
  doc.fillColor(muted).fontSize(9).font("Helvetica");
  doc.text(`Factuurdatum: ${date(data.invoiceDate)}`, metaX, doc.y, { width: metaWidth, align: "right" });
  doc.text(`Vervaldatum: ${date(data.dueDate)}`, metaX, doc.y, { width: metaWidth, align: "right" });
  const metaBottom = doc.y;

  doc.x = left;
  doc.y = Math.max(senderBottom, metaBottom) + 16;
  doc.strokeColor(accent).lineWidth(2).moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
  doc.moveDown(1);

  write("FACTUUR AAN", { color: muted, size: 8, bold: true, gap: 0.15 });
  write(data.customer.name, { color: ink, size: 11, bold: true });
  if (data.customer.contactName) write(`t.a.v. ${data.customer.contactName}`);
  if (data.customer.address) write(data.customer.address);
  const postal = [data.customer.postalCode, data.customer.city].filter(Boolean).join(" ");
  if (postal) write(postal);
  doc.moveDown(0.8);
  write(`Referentie: ${data.reference}`, { color: ink, bold: true });
  if (data.quoteNumber) write(`Offerte: ${data.quoteNumber}`, { color: muted });
  doc.moveDown(1);

  const columns = {
    description: { x: left, width: width * 0.51 },
    quantity: { x: left + width * 0.53, width: width * 0.12 },
    price: { x: left + width * 0.66, width: width * 0.16 },
    total: { x: left + width * 0.83, width: width * 0.17 },
  };
  const tableHeader = () => {
    const y = doc.y;
    doc.fillColor(muted).fontSize(8).font("Helvetica-Bold");
    doc.text("OMSCHRIJVING", columns.description.x, y, { width: columns.description.width });
    doc.text("AANTAL", columns.quantity.x, y, { width: columns.quantity.width, align: "right" });
    doc.text("PRIJS", columns.price.x, y, { width: columns.price.width, align: "right" });
    doc.text("TOTAAL", columns.total.x, y, { width: columns.total.width, align: "right" });
    doc.y = y + 14;
    doc.strokeColor(hairline).lineWidth(1).moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
    doc.y += 8;
  };
  const tableRow = (description: string, amount: string, price: string, total: string) => {
    const y = doc.y;
    doc.fillColor(body).fontSize(9).font("Helvetica");
    doc.text(description, columns.description.x, y, { width: columns.description.width });
    doc.text(amount, columns.quantity.x, y, { width: columns.quantity.width, align: "right" });
    doc.text(price, columns.price.x, y, { width: columns.price.width, align: "right" });
    doc.text(total, columns.total.x, y, { width: columns.total.width, align: "right" });
    doc.y = Math.max(y + 18, doc.y + 4);
  };

  tableHeader();
  tableRow(
    data.quoteNumber ? `Werkzaamheden volgens offerte ${data.quoteNumber}` : "Uitgevoerde werkzaamheden",
    "1",
    money(data.acceptedQuoteAmount),
    money(data.acceptedQuoteAmount),
  );
  for (const item of data.extraWork) {
    tableRow(
      `Meerwerk: ${item.description}`,
      `${quantity(item.quantity)} ${item.unit}`.trim(),
      money(item.unitPrice),
      money(item.quantity * item.unitPrice),
    );
  }

  const subtotal =
    data.acceptedQuoteAmount +
    data.extraWork.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;
  doc.moveDown(0.6);
  doc.strokeColor(hairline).lineWidth(1).moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
  doc.moveDown(0.6);
  for (const [label, value, bold] of [
    ["Subtotaal", subtotal, false],
    ["BTW 21%", vat, false],
    ["Te betalen", total, true],
  ] as const) {
    const y = doc.y;
    doc.fillColor(bold ? ink : body).fontSize(bold ? 11 : 9).font(bold ? "Helvetica-Bold" : "Helvetica");
    doc.text(label, columns.price.x, y, { width: columns.price.width, align: "right" });
    doc.text(money(value), columns.total.x, y, { width: columns.total.width, align: "right" });
    doc.y = y + (bold ? 20 : 15);
  }

  doc.moveDown(1.5);
  doc.fillColor(ink).fontSize(9).font("Helvetica-Bold").text(
    `Graag betalen vóór ${date(data.dueDate)} onder vermelding van ${data.invoiceNumber}.`,
    left,
    doc.y,
    { width },
  );
  if (org.iban) write(`IBAN: ${org.iban}${org.bic ? ` · BIC: ${org.bic}` : ""}`, { color: body });

  const footer = [
    org.kvkNumber ? `KVK ${org.kvkNumber}` : "",
    org.vatNumber ? `BTW ${org.vatNumber}` : "",
    org.website ?? "",
  ].filter(Boolean).join("  ·  ");
  if (footer) {
    doc.fillColor(muted).fontSize(8).font("Helvetica").text(
      footer,
      left,
      doc.page.height - doc.page.margins.bottom + 12,
      { width, align: "center" },
    );
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });
}
