"use client";

import { Filter, X } from "lucide-react";
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
  type MaterialReadinessFilter,
  type ProjectFilters,
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
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label="Filters"
          className="relative shrink-0"
          size="icon"
          variant="outline"
        >
          <Filter className="size-4" />
          {active ? (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500" />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
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
        {active ? (
          <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
            <span className="text-sm text-zinc-500">
              {matchCount} resultaten
            </span>
            <Button
              onClick={() => onChange(emptyFilters)}
              size="sm"
              variant="ghost"
            >
              <X className="size-4" />
              Wis filters
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
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
