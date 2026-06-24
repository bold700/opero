"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { useOperoStore } from "@/lib/store";

export function WerksoortenClient() {
  const werksoorten = useOperoStore((state) => state.werksoorten);
  const addWerksoort = useOperoStore((state) => state.addWerksoort);
  const renameWerksoort = useOperoStore((state) => state.renameWerksoort);
  const removeWerksoort = useOperoStore((state) => state.removeWerksoort);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Werksoorten</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {werksoorten.length} typen werk die je bij een project kiest
            </p>
          </div>
          <Button
            onClick={() => {
              // unieke standaardnaam, daarna inline hernoemen
              let name = "Nieuwe werksoort";
              let n = 2;
              while (
                werksoorten.some((w) => w.toLowerCase() === name.toLowerCase())
              ) {
                name = `Nieuwe werksoort ${n}`;
                n += 1;
              }
              addWerksoort(name);
              toast.success("Werksoort toegevoegd");
            }}
            size="sm"
          >
            <Plus className="size-4" />
            Nieuwe werksoort
          </Button>
        </div>
      </Card>

      <Card className="p-3">
        <ul className="space-y-2">
          {werksoorten.map((werksoort) => (
            <li className="flex items-center gap-2" key={werksoort}>
              <Input
                aria-label="Werksoort naam"
                defaultValue={werksoort}
                onBlur={(event) => {
                  const next = event.target.value.trim();
                  if (next && next !== werksoort) {
                    renameWerksoort(werksoort, next);
                  } else {
                    event.target.value = werksoort;
                  }
                }}
              />
              <Button
                aria-label={`Werksoort ${werksoort} verwijderen`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Werksoort "${werksoort}" verwijderen? Bestaande projecten met dit type behouden hun waarde.`,
                    )
                  ) {
                    removeWerksoort(werksoort);
                    toast.success("Werksoort verwijderd");
                  }
                }}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-4 text-zinc-500" />
              </Button>
            </li>
          ))}
          {werksoorten.length === 0 ? (
            <li>
              <EmptyState label="Nog geen werksoorten" />
            </li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
