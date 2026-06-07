"use client";

import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  emptyFilters,
  hasActiveFilters,
  quickFilterDefinitions,
  type MaterialReadinessFilter,
  type ProjectFilters,
  type QuickFilter,
} from "@/lib/project-filters";
import {
  projectStatusIds,
  projectStatusLabels,
  type ProjectStatus,
  type ProjectUrgency,
  type TeamMember,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const urgencyOptions: { label: string; value: ProjectUrgency }[] = [
  { label: "Normaal", value: "normal" },
  { label: "Urgent", value: "urgent" },
  { label: "Geblokkeerd", value: "blocked" },
];

const readinessOptions: { label: string; value: MaterialReadinessFilter }[] = [
  { label: "Beschikbaar", value: "available" },
  { label: "Deels", value: "partly_available" },
  { label: "Bestellen", value: "needs_ordering" },
];

export function ProjectsFilters({
  filters,
  matchCount,
  onChange,
  teamLeaders,
}: {
  filters: ProjectFilters;
  matchCount: number;
  onChange: (next: ProjectFilters) => void;
  teamLeaders: TeamMember[];
}) {
  const active = hasActiveFilters(filters);

  function toggleQuick(filter: QuickFilter) {
    const exists = filters.quickFilters.includes(filter);
    onChange({
      ...filters,
      quickFilters: exists
        ? filters.quickFilters.filter((f) => f !== filter)
        : [...filters.quickFilters, filter],
    });
  }

  function toggleStatus(status: ProjectStatus) {
    const exists = filters.statuses.includes(status);
    onChange({
      ...filters,
      statuses: exists
        ? filters.statuses.filter((f) => f !== status)
        : [...filters.statuses, status],
    });
  }

  function toggleUrgency(value: ProjectUrgency) {
    const exists = filters.urgencies.includes(value);
    onChange({
      ...filters,
      urgencies: exists
        ? filters.urgencies.filter((f) => f !== value)
        : [...filters.urgencies, value],
    });
  }

  function toggleReadiness(value: MaterialReadinessFilter) {
    const exists = filters.materialReadiness.includes(value);
    onChange({
      ...filters,
      materialReadiness: exists
        ? filters.materialReadiness.filter((f) => f !== value)
        : [...filters.materialReadiness, value],
    });
  }

  function toggleTeamLeader(id: string) {
    const exists = filters.teamLeaderIds.includes(id);
    onChange({
      ...filters,
      teamLeaderIds: exists
        ? filters.teamLeaderIds.filter((f) => f !== id)
        : [...filters.teamLeaderIds, id],
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {quickFilterDefinitions.map((def) => (
          <button
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
              filters.quickFilters.includes(def.id)
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950",
            )}
            key={def.id}
            onClick={() => toggleQuick(def.id)}
            title={def.description}
            type="button"
          >
            {def.label}
          </button>
        ))}
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" variant="outline">
            <Filter className="size-4" />
            Filters
            {active ? (
              <Badge className="ml-1" variant="emerald">
                {filtersBadge(filters)}
              </Badge>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Combineer filters om snel projecten terug te vinden.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <FilterGroup label="Fase">
              {projectStatusIds.map((status) => (
                <FilterChip
                  active={filters.statuses.includes(status)}
                  key={status}
                  label={projectStatusLabels[status]}
                  onClick={() => toggleStatus(status)}
                />
              ))}
            </FilterGroup>
            <FilterGroup label="Urgentie">
              {urgencyOptions.map((option) => (
                <FilterChip
                  active={filters.urgencies.includes(option.value)}
                  key={option.value}
                  label={option.label}
                  onClick={() => toggleUrgency(option.value)}
                />
              ))}
            </FilterGroup>
            <FilterGroup label="Materialen">
              {readinessOptions.map((option) => (
                <FilterChip
                  active={filters.materialReadiness.includes(option.value)}
                  key={option.value}
                  label={option.label}
                  onClick={() => toggleReadiness(option.value)}
                />
              ))}
            </FilterGroup>
            <FilterGroup label="Teamleider">
              {teamLeaders.length === 0 ? (
                <p className="text-xs text-zinc-500">Geen teamleiders bekend</p>
              ) : (
                teamLeaders.map((leader) => (
                  <FilterChip
                    active={filters.teamLeaderIds.includes(leader.id)}
                    key={leader.id}
                    label={leader.name}
                    onClick={() => toggleTeamLeader(leader.id)}
                  />
                ))
              )}
            </FilterGroup>
          </div>
        </SheetContent>
      </Sheet>
      {active ? (
        <Button
          onClick={() => onChange(emptyFilters)}
          size="sm"
          variant="ghost"
        >
          <X className="size-4" />
          Wissen
          <span className="ml-1 text-xs text-zinc-500">({matchCount})</span>
        </Button>
      ) : null}
    </div>
  );
}

function filtersBadge(filters: ProjectFilters) {
  return (
    filters.statuses.length +
    filters.urgencies.length +
    filters.teamLeaderIds.length +
    filters.materialReadiness.length +
    filters.quickFilters.length +
    (filters.search.trim().length > 0 ? 1 : 0)
  );
}

function FilterGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
