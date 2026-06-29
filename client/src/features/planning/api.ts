import { api } from "../../lib/api/client";

// Mirrors the backend planning calendar entry (planningEntriesForProject).
export type PlanningEntry = {
  projectId: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  plannedEndDate?: string;
  teamLeaderId?: string;
  teamLeaderName?: string;
  installerIds: string[];
  vehicle?: string;
  status: string;
};

export function getPlanning(from?: string, to?: string): Promise<PlanningEntry[]> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<PlanningEntry[]>(`/planning${suffix}`);
}

// --- Scheduling -----------------------------------------------------------

export type ScheduleInput = {
  date: string;
  teamLeaderId?: string | null;
  startTime?: string;
  endTime?: string;
  vehicle?: string;
};

// Schedule or reschedule a project (upsert). NOTE: these live under the planning
// router → /api/planning/projects/:id/planning.
export function scheduleProject(
  projectId: string,
  input: ScheduleInput,
): Promise<unknown> {
  return api.post(`/planning/projects/${projectId}/planning`, input);
}

// Remove a project from the planning.
export function unscheduleProject(projectId: string): Promise<void> {
  return api.delete<void>(`/planning/projects/${projectId}/planning`);
}

// --- Route overview (per day) ---------------------------------------------

export type RouteStop = PlanningEntry & { postalCode?: string };
type RouteResponse = { date: string; stops: RouteStop[] };

export async function getRoute(date: string): Promise<RouteStop[]> {
  const res = await api.get<RouteResponse>(`/planning/route?date=${date}`);
  return res.stops;
}

// --- Schedulable projects (for the schedule dialog dropdown) ---------------
export type SchedulableProject = {
  id: string;
  projectNumber: string;
  customerName: string;
  plannedDate?: string;
};

export function getProjectsForScheduling(): Promise<SchedulableProject[]> {
  return api.get<SchedulableProject[]>("/projects");
}

// Field staff for the team-leader dropdown in the schedule dialog.
export type AssignableEmployee = { id: string; name: string };
export function getAssignableEmployees(): Promise<AssignableEmployee[]> {
  return api.get<AssignableEmployee[]>("/work-orders/assignable");
}
