import { api } from "../../lib/api/client";

// The logged-in technician's own hours. Mirrors the backend
// GET /employees/:id/timesheet (backend/src/modules/employees/routes.ts), which
// allows a technician to read ONLY their own (user.employeeId === :id).

export type TimesheetEntry = {
  projectId: string;
  projectNumber: string;
  day: string | null;
  hours: number;
};

export type Timesheet = {
  employeeId: string;
  totalHours: number;
  entries: TimesheetEntry[];
};

export function getTimesheet(
  employeeId: string,
  from: string,
  to: string,
): Promise<Timesheet> {
  const qs = new URLSearchParams({ from, to }).toString();
  return api.get<Timesheet>(`/employees/${employeeId}/timesheet?${qs}`);
}
