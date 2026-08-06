import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { EmployeeStatus } from "./api";

// English status value → i18n label key + tone. Translate the key at the call site.
export const STATUS: Record<EmployeeStatus, { labelKey: string; tone: StatusTone }> = {
  active: { labelKey: "employees.status.active", tone: STATUS_TONES.success },
  on_leave: { labelKey: "employees.status.on_leave", tone: STATUS_TONES.warning },
  inactive: { labelKey: "employees.status.inactive", tone: STATUS_TONES.neutral },
};

// Stable filter values (English) → i18n label key. Translate at the call site.
// `no_account` answers "who did we forget to invite?" — the one access question
// that was easier on the old Toegang screen. Account status itself is not a
// filter dimension here: it's one column of six, and the list is search-first.
export const FILTERS = ["all", "technicians", "office", "inactive", "no_account"] as const;
export type EmployeeFilter = (typeof FILTERS)[number];

export const FILTER_LABEL_KEY: Record<EmployeeFilter, string> = {
  all: "employees.filters.all",
  technicians: "employees.filters.technicians",
  office: "employees.filters.office",
  inactive: "employees.filters.inactive",
  no_account: "employees.filters.no_account",
};

// English TeamRole value → i18n label key. Translate at the call site.
export const ROLE_LABEL_KEY: Record<string, string> = {
  Office: "employees.roles.office",
  ProjectLeader: "employees.roles.projectLeader",
  Foreman: "employees.roles.foreman",
  Technician: "employees.roles.technician",
};

// The office bucket is the single Office title since the 7→4 consolidation.
export function isOffice(fn: string | null): boolean {
  return fn === "Office";
}

// Default account access level for the Invite dialog, from the job title.
// Kantoor works in the office app; Voorman and Projectleider see all projects
// without office powers; Monteur (and the untitled) get the field app. Admin is
// never defaulted — making someone owner stays an explicit choice.
export function defaultAccessRole(
  fn: string | null,
): "office" | "foreman" | "technician" {
  switch (fn) {
    case "Office":
      return "office";
    case "Foreman":
    case "ProjectLeader":
      return "foreman";
    default:
      return "technician";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
