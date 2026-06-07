import {
  type Project,
  type ProjectStatus,
  type ProjectUrgency,
} from "@/lib/types";
import { getProjectMaterialReadiness } from "@/lib/workflow";

export type MaterialReadinessFilter =
  | "available"
  | "partly_available"
  | "needs_ordering";

export type QuickFilter =
  | "mine"
  | "blocked"
  | "this_week"
  | "awaiting_customer"
  | "ready_to_invoice"
  | "materials_missing"
  | "open_invoices";

export type ProjectFilters = {
  search: string;
  statuses: ProjectStatus[];
  urgencies: ProjectUrgency[];
  teamLeaderIds: string[];
  materialReadiness: MaterialReadinessFilter[];
  quickFilters: QuickFilter[];
};

export const emptyFilters: ProjectFilters = {
  materialReadiness: [],
  quickFilters: [],
  search: "",
  statuses: [],
  teamLeaderIds: [],
  urgencies: [],
};

export function hasActiveFilters(filters: ProjectFilters) {
  return (
    filters.search.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.urgencies.length > 0 ||
    filters.teamLeaderIds.length > 0 ||
    filters.materialReadiness.length > 0 ||
    filters.quickFilters.length > 0
  );
}

function inThisWeek(dateIso?: string) {
  if (!dateIso) return false;
  const today = new Date();
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const date = new Date(`${dateIso}T12:00:00`);
  return date >= start && date <= end;
}

function matchesQuickFilter(
  filter: QuickFilter,
  project: Project,
  activeTeamMemberId?: string,
) {
  switch (filter) {
    case "mine":
      if (!activeTeamMemberId) return false;
      return (
        project.projectLeaderId === activeTeamMemberId ||
        project.teamLeaderId === activeTeamMemberId ||
        project.installerIds.includes(activeTeamMemberId)
      );
    case "blocked":
      return project.urgency === "blocked" || Boolean(project.blocker);
    case "this_week":
      return inThisWeek(project.plannedDate);
    case "awaiting_customer":
      return (
        project.status === "verkoop" && project.quote.status === "sent"
      );
    case "ready_to_invoice":
      return (
        project.status === "afronding" &&
        (project.invoice.status === "not_started" ||
          project.invoice.status === "draft")
      );
    case "materials_missing":
      return getProjectMaterialReadiness(project) !== "available";
    case "open_invoices":
      return project.invoice.status === "sent";
    default:
      return false;
  }
}

export function applyProjectFilters(
  projects: Project[],
  filters: ProjectFilters,
  activeTeamMemberId?: string,
) {
  const needle = filters.search.trim().toLowerCase();

  return projects.filter((project) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(project.status)) {
      return false;
    }
    if (filters.urgencies.length > 0 && !filters.urgencies.includes(project.urgency)) {
      return false;
    }
    if (
      filters.teamLeaderIds.length > 0 &&
      !filters.teamLeaderIds.includes(project.teamLeaderId)
    ) {
      return false;
    }
    if (filters.materialReadiness.length > 0) {
      const readiness = getProjectMaterialReadiness(project);
      if (!filters.materialReadiness.includes(readiness)) return false;
    }
    if (needle) {
      const haystack = [
        project.customerName,
        project.projectNumber,
        project.address,
        project.city,
        project.postalCode,
        project.insulationType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filters.quickFilters.length > 0) {
      const allMatch = filters.quickFilters.every((filter) =>
        matchesQuickFilter(filter, project, activeTeamMemberId),
      );
      if (!allMatch) return false;
    }
    return true;
  });
}

export const quickFilterDefinitions: {
  id: QuickFilter;
  label: string;
  description: string;
}[] = [
  {
    description: "Projecten waar jij projectleider, teamleider of monteur op bent",
    id: "mine",
    label: "Mijn projecten",
  },
  {
    description: "Urgentie geblokkeerd of een open blokkade",
    id: "blocked",
    label: "Geblokkeerd",
  },
  {
    description: "Geplande dag valt in de huidige week",
    id: "this_week",
    label: "Deze week",
  },
  {
    description: "Offerte verstuurd, wachten op akkoord",
    id: "awaiting_customer",
    label: "Wacht op klant",
  },
  {
    description: "In Afronding maar factuur nog niet verstuurd",
    id: "ready_to_invoice",
    label: "Klaar voor factuur",
  },
  {
    description: "Materialen niet volledig op voorraad",
    id: "materials_missing",
    label: "Materialen ontbreken",
  },
  {
    description: "Factuur verstuurd, wachten op betaling",
    id: "open_invoices",
    label: "Open facturen",
  },
];
