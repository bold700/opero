"use client";

import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOperoStore } from "@/lib/store";
import { formatCurrency, formatLongDate } from "@/lib/utils";

export function OffertePrint() {
  const routeId = useSearchParams().get("id");
  const project = useOperoStore((state) =>
    state.projects.find((item) => item.id === routeId),
  );
  const customer = useOperoStore((state) =>
    project
      ? state.customers.find((item) => item.id === project.customerId)
      : undefined,
  );

  if (!project || !customer) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">
        Offerte niet gevonden.
      </div>
    );
  }

  // Offerte = de gedeelde projectregels (per zone), met prijs.
  const lines = (project.werkbonnen ?? []).flatMap((werkbon) =>
    werkbon.tasks.flatMap((task) =>
      task.materials
        .filter((m) => m.name.trim())
        .map((m) => ({
          id: m.id,
          zone: task.description,
          description: `${m.name}${m.diameter ? ` Ø${m.diameter}` : ""}`,
          quantity: m.quantity,
          unit: m.unit,
          unitPrice: m.unitPrice ?? 0,
        })),
    ),
  );
  const total =
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) ||
    project.value;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-zinc-100 p-6 print:static print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / opslaan als PDF
        </Button>
      </div>

      <div className="mx-auto max-w-3xl rounded-lg bg-white p-10 shadow-sm print:rounded-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-emerald-700">Opero</p>
            <p className="text-sm text-zinc-500">Technische isolatie</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-zinc-900">Offerte</p>
            <p className="text-zinc-500">{project.projectNumber}</p>
            <p className="text-zinc-500">
              {formatLongDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-semibold uppercase text-zinc-400">Aan</p>
            <p className="font-medium text-zinc-900">{customer.name}</p>
            <p className="text-zinc-600">{customer.contactName}</p>
            <p className="text-zinc-600">
              {customer.address}, {customer.postalCode} {customer.city}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase text-zinc-400">Project</p>
            <p className="text-zinc-700">{project.insulationType}</p>
            <p className="text-zinc-600">
              {project.address}, {project.city}
            </p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-zinc-500">
              <th className="py-2">Omschrijving</th>
              <th className="py-2 text-right">Aantal</th>
              <th className="py-2 text-right">Prijs</th>
              <th className="py-2 text-right">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr className="border-b border-zinc-100" key={line.id}>
                <td className="py-2 text-zinc-800">
                  {line.zone ? (
                    <span className="text-zinc-400">{line.zone} · </span>
                  ) : null}
                  {line.description}
                </td>
                <td className="py-2 text-right text-zinc-700">
                  {line.quantity} {line.unit}
                </td>
                <td className="py-2 text-right text-zinc-700">
                  {formatCurrency(line.unitPrice)}
                </td>
                <td className="py-2 text-right font-medium text-zinc-900">
                  {formatCurrency(line.quantity * line.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-3 text-right font-semibold text-zinc-900" colSpan={3}>
                Totaal (excl. btw)
              </td>
              <td className="py-3 text-right text-base font-bold text-zinc-900">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {project.exclusions ? (
          <div className="mt-6 text-sm">
            <p className="font-semibold uppercase text-zinc-400">
              Uitsluitingen / voorwaarden
            </p>
            <p className="mt-1 whitespace-pre-line text-zinc-600">
              {project.exclusions}
            </p>
          </div>
        ) : null}

        <p className="mt-10 text-xs text-zinc-400">
          Offerte geldig 30 dagen. Prijzen exclusief btw.
        </p>
      </div>
    </div>
  );
}
