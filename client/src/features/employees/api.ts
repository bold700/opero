import { api, type Page } from "../../lib/api/client";
import type { LinkedAccount } from "../users/api";

export type EmployeeStatus = "active" | "on_leave" | "inactive";

// The TeamRole enum values (internal English; labels via employees.roles.*).
export const TEAM_ROLES = [
  "Sales",
  "WorkPlanner",
  "Planner",
  "Foreman",
  "Technician",
  "Administration",
  "ProjectLeader",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  "active",
  "on_leave",
  "inactive",
];

// Mirrors the backend employeeListDto (backend/src/modules/employees/dto.ts).
export type EmployeeRow = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  roles: string[];
  function: string | null;
  status: EmployeeStatus;
  workOrderCount: number;
  // The linked login account, if any (null = no login provisioned yet).
  account: LinkedAccount;
};

// Editable fields (the create/update schema).
export type EmployeeInput = {
  name: string;
  phone?: string;
  email?: string;
  roles?: TeamRole[];
  status?: EmployeeStatus;
};

// Per-category totals across the whole (searched) set — powers the KPI cards.
// Always present even when a filter is active.
export type EmployeeCounts = {
  total: number;
  active: number;
  on_leave: number;
  inactive: number;
  technicians: number;
  office: number;
};

// One page of the employees list plus the counts.
export type EmployeePage = Page<EmployeeRow> & { counts: EmployeeCounts };

// Fetch one page. `filter` filters server-side (undefined = all); `search`
// searches name/email/phone server-side; `cursor` continues the list.
export function getEmployeesPage(opts: {
  cursor?: string;
  search?: string;
  filter?: "technicians" | "office" | "inactive";
}): Promise<EmployeePage> {
  return api.getPage<EmployeeRow>("/employees", {
    cursor: opts.cursor,
    search: opts.search,
    params: { filter: opts.filter },
  }) as Promise<EmployeePage>;
}

// Creating an employee also auto-provisions a login for them when they have an
// email address, so the response carries the outcome of that attempt. It is
// best-effort by design (see backend users/provisioning.ts): the employee is
// saved either way, and `invite` says whether the account went out.
export type AutoInviteResult =
  | { invited: true; userId: string }
  | { invited: false; reason: "no_email" | "email_taken" | "send_failed" };

export function createEmployee(
  input: EmployeeInput,
): Promise<EmployeeRow & { invite?: AutoInviteResult }> {
  return api.post<EmployeeRow & { invite?: AutoInviteResult }>("/employees", input);
}

export function updateEmployee(
  id: string,
  input: EmployeeInput,
): Promise<EmployeeRow> {
  return api.patch<EmployeeRow>(`/employees/${id}`, input);
}

export function deleteEmployee(id: string): Promise<void> {
  return api.delete<void>(`/employees/${id}`);
}

// --- Absences (vacation / sick / training) ---------------------------------
//
// Dated periods in which someone is unavailable, so planning stops offering
// them. Dates are inclusive plain "YYYY-MM-DD" days — a single day off has
// startDate === endDate.

export type AbsenceKind = "vacation" | "sick" | "training" | "other";

export type Absence = {
  id: string;
  employeeId: string;
  employeeName?: string;
  kind: AbsenceKind;
  startDate: string;
  endDate: string;
  note?: string;
};

export type AbsenceInput = {
  employeeId: string;
  kind: AbsenceKind;
  startDate: string;
  endDate: string;
  note?: string;
};

// Omit the range to get everything from today onward (the planning default).
export function getAbsences(opts?: {
  from?: string;
  to?: string;
  employeeId?: string;
}): Promise<Absence[]> {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set("from", opts.from);
  if (opts?.to) qs.set("to", opts.to);
  if (opts?.employeeId) qs.set("employeeId", opts.employeeId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<Absence[]>(`/employees/absences${suffix}`);
}

export function createAbsence(input: AbsenceInput): Promise<Absence> {
  return api.post<Absence>("/employees/absences", input);
}

export function deleteAbsence(id: string): Promise<void> {
  return api.delete<void>(`/employees/absences/${id}`);
}
