"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { CustomerDialog } from "@/components/customer-dialog";
import { useOperoStore } from "@/lib/store";
import { initials } from "@/lib/utils";
import { type Customer } from "@/lib/types";

export function KlantenClient() {
  const [query, setQuery] = useState("");
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Profielen</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-950">
            Klanten
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Opdrachtgevers met hun contactgegevens. Maak een klant aan, en beheer
            de gegevens later via Bewerken.
          </p>
        </div>
        <Input
          className="md:w-72"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op naam of plaats"
          value={query}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{customers.length} klanten</p>
        <CustomerDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Nieuwe klant
            </Button>
          }
        />
      </div>

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
