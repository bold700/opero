import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { inflateSync } from "node:zlib";
import type { Organization } from "@prisma/client";
import { buildInvoicePdf } from "./pdf.js";

function extractText(pdf: Buffer): string {
  let raw = "";
  for (const match of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      raw += inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      // Images/fonts are not deflate text streams.
    }
  }
  return [...raw.matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
}

describe("invoice PDF", () => {
  it("renders a complete branded invoice with approved extra work", async () => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding: unknown, callback: () => void) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    const org = {
      id: "org",
      name: "WDB Isolatie",
      slug: null,
      email: "info@wdb.nl",
      address: "Markt 1",
      postalCode: "3500 AA",
      city: "Utrecht",
      phone: "0301234567",
      vatNumber: "NL123",
      iban: "NL00BANK0123456789",
      bic: "BANKNL2A",
      kvkNumber: "12345678",
      website: "wdb.nl",
      logo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Organization;

    await buildInvoicePdf(
      {
        invoiceNumber: "INV-2026-0001",
        invoiceDate: "2026-09-29",
        dueDate: "2026-10-13",
        reference: "OP-2026-013 · Zolder",
        quoteNumber: "20260013",
        customer: {
          name: "Atelier Vermeer",
          address: "Markt 9",
          postalCode: "2611 GP",
          city: "Delft",
        },
        acceptedQuoteAmount: 1000,
        extraWork: [
          { description: "Extra afdichting", quantity: 2, unit: "meter", unitPrice: 25 },
        ],
      },
      { org },
      sink,
    );
    await new Promise((resolve) => sink.end(resolve));
    const pdf = Buffer.concat(chunks);
    const text = extractText(pdf);

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(text).toContain("FACTUUR");
    expect(text).toContain("INV-2026-0001");
    expect(text).toContain("Atelier Vermeer");
    expect(text).toContain("Meerwerk: Extra afdichting");
    expect(text).toContain("Te betalen");
  });
});
