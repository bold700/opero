import { api, type Page } from "../../lib/api/client";
import type { LinkedAccount } from "../users/api";

export type EmployeeStatus = "active" | "on_leave" | "inactive";

// The TeamRole enum values (internal English; labels via employees.roles.*).
// Four on purpose: the office-side titles were consolidated into one Office.
export const TEAM_ROLES = [
  "Office",
  "ProjectLeader",
  "Foreman",
  "Technician",
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
  // The single job title (null = none set yet). `function` is the same value
  // under the name the list column reads; both come from the backend DTO.
  role: TeamRole | null;
  function: string | null;
  status: EmployeeStatus;
  workOrderCount: number;
  // The linked login account, if any (null = no login provisioned yet).
  account: LinkedAccount;
};

// Editable fields (the create/update schema).
// No access level here: an employee record carries no login. Access is granted
// separately via inviteUser(), which is where the role is chosen.
export type EmployeeInput = {
  name: string;
  phone?: string;
  email?: string;
  // null clears the job title; omitted leaves it untouched.
  role?: TeamRole | null;
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
  no_account: number;
};

// One page of the employees list plus the counts.
export type EmployeePage = Page<EmployeeRow> & { counts: EmployeeCounts };

// Fetch one page. `filter` filters server-side (undefined = all); `search`
// searches name/email/phone server-side; `cursor` continues the list.
export function getEmployeesPage(opts: {
  cursor?: string;
  search?: string;
  filter?: "technicians" | "office" | "inactive" | "no_account";
}): Promise<EmployeePage> {
  return api.getPage<EmployeeRow>("/employees", {
    cursor: opts.cursor,
    search: opts.search,
    params: { filter: opts.filter },
  }) as Promise<EmployeePage>;
}

// Creates the employee record only — no login, no email. Giving this person
// access is a separate, deliberate step: inviteUser() behind the Uitnodigen
// button on the saved employee.
export function createEmployee(input: EmployeeInput): Promise<EmployeeRow> {
  return api.post<EmployeeRow>("/employees", input);
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
