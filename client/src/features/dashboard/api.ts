import { api } from "../../lib/api/client";

// Mirrors the backend's role-aware dashboard payload (see backend dashboard/dto.ts).
export type AdminDashboard = {
  role: "admin";
  kpis: {
    totalProjects: number;
    activeProjects: number;
    plannedThisWeek: number;
    readyToInvoice: number;
    recentActivity: number;
  };
  byStatus: Record<string, number>;
  byStage: Record<string, number>;
  pipelineValue: number;
  urgentCount: number;
  blockedCount: number;
  openInvoices: number;
  // Sales insight over the werkbon lines. See backend dashboard/dto.ts.
  sales: {
    sold: number;
    cost: number;
    profit: number;
    metersLaid: number;
  };
};

export type TechnicianProjectRow = {
  id: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  status: string;
  stage: string;
  plannedDate: string | null;
  nextStepKey: string;
  openTaskCount: number;
  // The werkbon to open on tap. Null when the project has several relevant
  // ones — there is no single right target, so the row is not a link.
  workOrderId: string | null;
};

// The foreman shares the technician's money-free shape, org-wide scoped. Two
// union members rather than one with `role: "technician" | "foreman"`: TS
// can't EXCLUDE a member by negative discriminant checks when the discriminant
// is itself a union, which broke the AdminView fallthrough in Dashboard.tsx.
type FieldDashboardBase = {
  /** The assigned work, earliest planned first, undated last. */
  projects: TechnicianProjectRow[];
  openTaskCount: number;
  assignedProjectCount: number;
};

export type TechnicianDashboard = FieldDashboardBase & { role: "technician" };
export type ForemanDashboard = FieldDashboardBase & { role: "foreman" };

export type ClientProjectRow = {
  id: string;
  projectNumber: string;
  status: string;
  stage: string;
  plannedDate: string | null;
  nextStepKey: string;
};

export type ClientDashboard = {
  role: "client";
  projects: ClientProjectRow[];
  byStatus: Record<string, number>;
};

export type DashboardData =
  | AdminDashboard
  | TechnicianDashboard
  | ForemanDashboard
  | ClientDashboard;

export type SalesPeriod = "all" | "month" | "year" | "30d";

// `salesPeriod` bounds the Sales & usage block only (admin view).
export function getDashboard(salesPeriod: SalesPeriod = "all"): Promise<DashboardData> {
  return api.get<DashboardData>(`/dashboard?salesPeriod=${salesPeriod}`);
}
