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

// --- monteur -------------------------------------------------------------

export type MonteurProjectRow = {
  id: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStep: string;
  openTaskCount: number;
};

export type MonteurDashboard = {
  role: "monteur";
  todayProjects: MonteurProjectRow[];
  upcomingProjects: MonteurProjectRow[];
  openTaskCount: number;
  assignedProjectCount: number;
};

// --- klant ---------------------------------------------------------------

export type KlantProjectRow = {
  id: string;
  projectNumber: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStep: string;
};

export type KlantDashboard = {
  role: "klant";
  projects: KlantProjectRow[];
  byStatus: Record<ProjectStatus, number>;
};

type MonteurProjectSource = {
  id: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStep: string;
};

export function monteurProjectRow(
  p: MonteurProjectSource,
  openTaskCount: number,
): MonteurProjectRow {
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    customerName: p.customerName,
    address: p.address,
    city: p.city,
    status: p.status,
    stage: p.stage,
    plannedDate: p.plannedDate ?? null,
    nextStep: p.nextStep,
    openTaskCount,
  };
}

type KlantProjectSource = {
  id: string;
  projectNumber: string;
  status: ProjectStatus;
  stage: Stage;
  plannedDate: string | null;
  nextStep: string;
};

export function klantProjectRow(p: KlantProjectSource): KlantProjectRow {
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    status: p.status,
    stage: p.stage,
    plannedDate: p.plannedDate ?? null,
    nextStep: p.nextStep,
  };
}
