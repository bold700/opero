"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Customer, type Project } from "@/lib/types";
import { formatCurrency, formatLongDate } from "@/lib/utils";

type DocumentKind = "offerte" | "factuur";

export function DocumentDialog({
  customer,
  kind,
  onOpenChange,
  open,
  project,
  primaryAction,
}: {
  customer?: Customer;
  kind: DocumentKind;
  onOpenChange: (next: boolean) => void;
  open: boolean;
  project: Project;
  primaryAction?: React.ReactNode;
}) {
  const isInvoice = kind === "factuur";
  const documentNumber = isInvoice
    ? project.invoice.id.replace("inv-p-", "F-")
    : project.quote.id.replace("q-p-", "O-");
  const issueDate = isInvoice
    ? project.invoice.sentDate ?? project.invoice.paidDate
    : project.quote.sentDate ?? project.quote.acceptedDate;

  type DocumentLine = {
    description: string;
    total: number;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
  };

  const lines: DocumentLine[] = isInvoice
    ? [
        {
          description: "Geaccepteerde offerte",
          total: project.invoice.acceptedQuoteAmount,
        },
        {
          description: "Materialen",
          total: project.invoice.materialsAmount,
        },
        { description: "Arbeid", total: project.invoice.laborAmount },
        {
          description: "Meerwerk",
          total: project.invoice.extraWorkAmount,
        },
      ].filter((line) => line.total > 0)
    : project.quote.lineItems.map((line) => ({
        description: line.description,
        total: Math.round(line.quantity * line.unitPrice),
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
      }));

  const subtotal = isInvoice
    ? project.invoice.acceptedQuoteAmount +
      project.invoice.materialsAmount +
      project.invoice.laborAmount +
      project.invoice.extraWorkAmount
    : project.quote.amount;
  const vat = Math.round(subtotal * 0.21);
  const total = subtotal + vat;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogTitle className="sr-only">
          {isInvoice ? "Factuur" : "Offerte"} {documentNumber}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isInvoice ? "Factuur" : "Offerte"} voor project {project.projectNumber}
          {project.customerName ? ` van ${project.customerName}` : ""}.
        </DialogDescription>
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              {isInvoice ? "Factuur" : "Offerte"}
            </p>
            <Button
              onClick={() => {
                try {
                  window.print();
                } catch {
                  /* iOS Safari can throw; gebruiker krijgt alsnog systeem-print */
                }
              }}
              size="sm"
              variant="ghost"
            >
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-8 py-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-600 text-base font-bold text-white">
                OP
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-950">
                Opero Isolatie B.V.
              </p>
              <p className="text-sm leading-5 text-zinc-600">
                Industrieweg 12
                <br />
                3433 ND Nieuwegein
                <br />
                btw NL 8587.96.421.B01
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {isInvoice ? "Factuurnummer" : "Offertenummer"}
              </p>
              <p className="text-base font-semibold text-zinc-950">
                {documentNumber}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">
                Datum
              </p>
              <p className="text-sm font-medium text-zinc-950">
                {issueDate ? formatLongDate(issueDate) : "Concept"}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wide text-zinc-500">
                Project
              </p>
              <p className="text-sm font-medium text-zinc-950">
                {project.projectNumber}
              </p>
            </div>
          </div>

          {customer ? (
            <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Aan
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {customer.name}
              </p>
              <p className="text-sm leading-5 text-zinc-600">
                {customer.contactName}
                <br />
                {customer.address}
                <br />
                {customer.postalCode} {customer.city}
              </p>
            </div>
          ) : null}

          <div className="mt-8">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Werkomschrijving
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              {project.insulationType}
              {project.squareMeters > 0 ? `, ${project.squareMeters} m2` : ""}
              {" "}- inclusief levering, montage en afwerking.
            </p>
          </div>

          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3 font-medium">Omschrijving</th>
                {!isInvoice ? (
                  <>
                    <th className="py-2 pr-3 text-right font-medium">Aantal</th>
                    <th className="py-2 pr-3 text-right font-medium">Prijs</th>
                  </>
                ) : null}
                <th className="py-2 text-right font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr
                  className="border-b border-zinc-100"
                  key={`${line.description}-${index}`}
                >
                  <td className="py-3 pr-3 align-top text-zinc-950">
                    {line.description}
                  </td>
                  {!isInvoice && line.quantity !== undefined ? (
                    <>
                      <td className="py-3 pr-3 text-right text-zinc-600">
                        {line.quantity} {line.unit ?? ""}
                      </td>
                      <td className="py-3 pr-3 text-right text-zinc-600">
                        {formatCurrency(line.unitPrice ?? 0)}
                      </td>
                    </>
                  ) : null}
                  <td className="py-3 text-right font-medium text-zinc-950">
                    {formatCurrency(line.total)}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td
                    className="py-6 text-center text-sm text-zinc-500"
                    colSpan={isInvoice ? 2 : 4}
                  >
                    Geen regels
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr className="text-sm text-zinc-600">
                <td className="py-2 pr-3" colSpan={isInvoice ? 1 : 3}>
                  Subtotaal
                </td>
                <td className="py-2 text-right">{formatCurrency(subtotal)}</td>
              </tr>
              <tr className="text-sm text-zinc-600">
                <td className="py-2 pr-3" colSpan={isInvoice ? 1 : 3}>
                  Btw 21%
                </td>
                <td className="py-2 text-right">{formatCurrency(vat)}</td>
              </tr>
              <tr className="border-t border-zinc-200 text-base font-semibold text-zinc-950">
                <td className="py-3 pr-3" colSpan={isInvoice ? 1 : 3}>
                  Totaal
                </td>
                <td className="py-3 text-right">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>

          {isInvoice ? (
            <p className="mt-6 text-xs leading-5 text-zinc-500">
              Te voldoen binnen 14 dagen op NL12 RABO 0123 4567 89 onder
              vermelding van het factuurnummer.
            </p>
          ) : (
            <p className="mt-6 text-xs leading-5 text-zinc-500">
              Deze offerte is 30 dagen geldig. Bij akkoord plannen we het werk
              binnen 2 weken in.
            </p>
          )}
        </div>

        {primaryAction ? (
          <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-3">
            {primaryAction}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
