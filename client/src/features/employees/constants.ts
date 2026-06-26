import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { EmployeeStatus } from "./api";

// English status value → i18n label key + tone. Translate the key at the call site.
export const STATUS: Record<EmployeeStatus, { labelKey: string; tone: StatusTone }> = {
  active: { labelKey: "employees.status.active", tone: STATUS_TONES.success },
  on_leave: { labelKey: "employees.status.on_leave", tone: STATUS_TONES.warning },
  inactive: { labelKey: "employees.status.inactive", tone: STATUS_TONES.neutral },
};

// Stable filter values (English) → i18n label key. Translate at the call site.
export const FILTERS = ["all", "technicians", "office", "inactive"] as const;
export type EmployeeFilter = (typeof FILTERS)[number];

export const FILTER_LABEL_KEY: Record<EmployeeFilter, string> = {
  all: "employees.filters.all",
  technicians: "employees.filters.technicians",
  office: "employees.filters.office",
  inactive: "employees.filters.inactive",
};

// English TeamRole value → i18n label key. Translate at the call site.
export const ROLE_LABEL_KEY: Record<string, string> = {
  Technician: "employees.roles.technician",
  Foreman: "employees.roles.foreman",
  WorkPlanner: "employees.roles.workPlanner",
  Planner: "employees.roles.planner",
  ProjectLeader: "employees.roles.projectLeader",
  Administration: "employees.roles.administration",
  Sales: "employees.roles.sales",
};

// Roles considered "office" (vs field/monteur).
const OFFICE_ROLES = new Set(["Administration", "Sales", "WorkPlanner", "Planner"]);
export function isOffice(fn: string | null): boolean {
  return fn ? OFFICE_ROLES.has(fn) : false;
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
