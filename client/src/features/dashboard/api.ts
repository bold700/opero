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
};

export type TechnicianDashboard = {
  role: "technician";
  todayProjects: TechnicianProjectRow[];
  upcomingProjects: TechnicianProjectRow[];
  openTaskCount: number;
  assignedProjectCount: number;
};

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

export type DashboardData = AdminDashboard | TechnicianDashboard | ClientDashboard;

export function getDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>("/dashboard");
}
