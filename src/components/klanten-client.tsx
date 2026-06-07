"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Search, Table as TableIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerDialog } from "@/components/customer-dialog";
import { useOperoStore } from "@/lib/store";
import { initials } from "@/lib/utils";
import { type Customer } from "@/lib/types";

type View = "card" | "table";

export function KlantenClient() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("card");
  const customers = useOperoStore((state) => state.customers);
  const projects = useOperoStore((state) => state.projects);

  const projectCount = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((project) => {
      map.set(project.customerId, (map.get(project.customerId) ?? 0) + 1);
    });
    return map;
  }, [projects]);

  const filtered = customers.filter((customer) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
      customer.name.toLowerCase().includes(needle) ||
      customer.city.toLowerCase().includes(needle) ||
      customer.contactName.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Klanten</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "klant" : "klanten"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="h-9 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Zoek op naam of plaats"
                value={query}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-zinc-200 p-0.5">
                <Button
                  className={view === "card" ? "bg-zinc-100" : ""}
                  onClick={() => setView("card")}
                  size="sm"
                  variant="ghost"
                >
                  <LayoutGrid className="size-4" />
                  Kaart
                </Button>
                <Button
                  className={view === "table" ? "bg-zinc-100" : ""}
                  onClick={() => setView("table")}
                  size="sm"
                  variant="ghost"
                >
                  <TableIcon className="size-4" />
                  Tabel
                </Button>
              </div>
              <CustomerDialog
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" />
                    Nieuwe klant
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {view === "card" ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((customer) => (
            <KlantCard
              key={customer.id}
              customer={customer}
              projectCount={projectCount.get(customer.id) ?? 0}
            />
          ))}
          {filtered.length === 0 ? (
            <div className="lg:col-span-2 xl:col-span-3">
              <EmptyState label="Geen klanten gevonden" />
            </div>
          ) : null}
        </div>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead className="w-44">Contactpersoon</TableHead>
                  <TableHead className="w-32">Plaats</TableHead>
                  <TableHead className="w-28 text-right">Projecten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <KlantRow
                    key={customer.id}
                    customer={customer}
                    projectCount={projectCount.get(customer.id) ?? 0}
                  />
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="text-center text-sm text-zinc-500"
                      colSpan={4}
                    >
                      Geen klanten gevonden
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function KlantCard({
  customer,
  projectCount,
}: {
  customer: Customer;
  projectCount: number;
}) {
  return (
    <CustomerDialog
      customer={customer}
      trigger={
        <button
          className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
          type="button"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700">
            {initials(customer.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-zinc-950">
              {customer.name}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {customer.contactName || "Geen contactpersoon"}
              {customer.city ? ` · ${customer.city}` : ""}
            </p>
          </div>
          <Badge variant="outline">{projectCount} projecten</Badge>
        </button>
      }
    />
  );
}

function KlantRow({
  customer,
  projectCount,
}: {
  customer: Customer;
  projectCount: number;
}) {
  return (
    <TableRow>
      <TableCell>
        <CustomerDialog
          customer={customer}
          trigger={
            <button
              className="flex items-center gap-3 text-left transition hover:opacity-80 focus-visible:outline-none"
              type="button"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700">
                {initials(customer.name)}
              </div>
              <span className="font-medium text-zinc-950 hover:underline">
                {customer.name}
              </span>
            </button>
          }
        />
      </TableCell>
      <TableCell className="text-sm text-zinc-600">
        {customer.contactName || "—"}
      </TableCell>
      <TableCell className="text-sm text-zinc-600">
        {customer.city || "—"}
      </TableCell>
      <TableCell className="text-right">
        <Badge variant="outline">{projectCount}</Badge>
      </TableCell>
    </TableRow>
  );
}
