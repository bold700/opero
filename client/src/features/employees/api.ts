import { api } from "../../lib/api/client";

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
};

// Editable fields (the create/update schema).
export type EmployeeInput = {
  name: string;
  phone?: string;
  email?: string;
  roles?: TeamRole[];
  status?: EmployeeStatus;
};

export function getEmployees(): Promise<EmployeeRow[]> {
  return api.get<EmployeeRow[]>("/employees");
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
