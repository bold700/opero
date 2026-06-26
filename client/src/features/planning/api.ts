import { api } from "../../lib/api/client";

// Mirrors the backend planning calendar entry
// (backend/src/modules/planning — planningEntriesForProject).
export type PlanningEntry = {
  projectId: string;
  projectNumber: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  teamLeaderId: string | null;
  installerIds: string[];
  vehicle: string | null;
  status: string;
};

export function getPlanning(from?: string, to?: string): Promise<PlanningEntry[]> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return api.get<PlanningEntry[]>(`/planning${suffix}`);
}
