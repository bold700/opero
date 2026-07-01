import { api } from "./client";

// A single search result row. `id` + the group decide where clicking navigates.
export type SearchHit = { id: string; label: string; sublabel?: string };

export type SearchResults = {
  customers: SearchHit[];
  projects: SearchHit[];
  workOrders: SearchHit[];
};

// GET /search?q= — role-scoped global search across customers, projects and
// work orders. Returns empty groups for q shorter than 2 chars (server-enforced).
export function search(q: string): Promise<SearchResults> {
  return api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
}

// Total hit count across all groups (for empty-state logic).
export function totalHits(r: SearchResults): number {
  return r.customers.length + r.projects.length + r.workOrders.length;
}
