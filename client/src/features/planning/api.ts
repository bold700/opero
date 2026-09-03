import { api } from "../../lib/api/client";

// Mirrors the backend planning calendar entry (per-werkbon now).
export type PlanningEntry = {
  workOrderId: string;
  workOrderTitle: string;
  projectId: string;
  projectNumber: string;
  projectName?: string;
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
  installerNames: string[];
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

// Schedule or reschedule a WERKBON (upsert). Scheduling is per-werkbon now:
// /api/planning/work-orders/:id/planning.
export function scheduleWorkOrder(
  workOrderId: string,
  input: ScheduleInput,
): Promise<unknown> {
  return api.post(`/planning/work-orders/${workOrderId}/planning`, input);
}

// Remove a werkbon from the planning.
export function unscheduleWorkOrder(workOrderId: string): Promise<void> {
  return api.delete<void>(`/planning/work-orders/${workOrderId}/planning`);
}

// --- Route overview (per day) ---------------------------------------------

export type RouteStop = PlanningEntry & { postalCode?: string };
type RouteResponse = { date: string; stops: RouteStop[] };

export async function getRoute(date: string): Promise<RouteStop[]> {
  const res = await api.get<RouteResponse>(`/planning/route?date=${date}`);
  return res.stops;
}

// --- Schedulable werkbonnen (for the schedule dialog dropdown) -------------
// Scheduling is per-werkbon now, so the "new schedule" picker lists werkbonnen,
// not projects. Each werkbon is a schedulable visit.
export type SchedulableWorkOrder = {
  id: string;
  number: string; // the parent project's number (display)
  customerName: string;
  city: string;
};

// The work-orders list endpoint is cursor-paginated and returns items under
// `items`; drain all pages so the picker sees the full in-scope set.
export function getWorkOrdersForScheduling(): Promise<SchedulableWorkOrder[]> {
  return api.getAll<SchedulableWorkOrder>("/work-orders");
}

// Field staff for the team-leader dropdown in the schedule dialog.
//
// Pass a date to get availability with it: anyone whose holiday/sick leave
// covers that day comes back annotated `unavailable` instead of being dropped,
// so the picker can grey them out with a reason. A missing name would read as
// "no longer employed"; a greyed-out one reads as "away, pick someone else".
export type AssignableEmployee = {
  id: string;
  name: string;
  unavailable?: { kind: string; startDate: string; endDate: string };
};

export function getAssignableEmployees(opts?: {
  date?: string;
  endDate?: string;
}): Promise<AssignableEmployee[]> {
  const qs = new URLSearchParams();
  if (opts?.date) qs.set("date", opts.date);
  if (opts?.endDate) qs.set("endDate", opts.endDate);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<AssignableEmployee[]>(`/work-orders/assignable${suffix}`);
}
