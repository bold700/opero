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
