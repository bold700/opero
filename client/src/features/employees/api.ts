import { api } from "../../lib/api/client";

export type EmployeeStatus = "active" | "on_leave" | "inactive";

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

export function getEmployees(): Promise<EmployeeRow[]> {
  return api.get<EmployeeRow[]>("/employees");
}
