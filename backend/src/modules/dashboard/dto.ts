import type { ProjectStatus, Stage } from "@prisma/client";

// DTO shapes for the role-aware dashboard payload. Kept here so routes.ts stays
// focused on aggregation logic. Every shape is a plain serializable object —
// never raw Prisma rows.

// --- admin ---------------------------------------------------------------

export type AdminDashboard = {
  role: "admin";
  kpis: {
    totalProjects: number;
    activeProjects: number; // not yet paid/closed
    plannedThisWeek: number;
    readyToInvoice: number;
    recentActivity: number;
  };
  byStatus: Record<ProjectStatus, number>;
  byStage: Record<Stage, number>;
  pipelineValue: number;
  urgentCount: number;
  blockedCount: number;
  openInvoices: number;
};

// --- technician ----------------------------------------------------------

export type TechnicianProjectRow = {
  id: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  status: ProjectStatus;
  stage: Stage;
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

// --- client --------------------------------------------------------------

export type ClientProjectRow = {
  id: string;
  projectNumber: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStepKey: string;
};

export type ClientDashboard = {
  role: "client";
  projects: ClientProjectRow[];
  byStatus: Record<ProjectStatus, number>;
};

type TechnicianProjectSource = {
  id: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStepKey: string;
};

export function technicianProjectRow(
  p: TechnicianProjectSource,
  openTaskCount: number,
): TechnicianProjectRow {
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    customerName: p.customerName,
    address: p.address,
    city: p.city,
    status: p.status,
    stage: p.stage,
    plannedDate: p.plannedDate ?? null,
    nextStepKey: p.nextStepKey,
    openTaskCount,
  };
}

type ClientProjectSource = {
  id: string;
  projectNumber: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStepKey: string;
};

export function clientProjectRow(p: ClientProjectSource): ClientProjectRow {
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    status: p.status,
    stage: p.stage,
    plannedDate: p.plannedDate ?? null,
    nextStepKey: p.nextStepKey,
  };
}
