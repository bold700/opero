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
  // Sales insight over the werkbon lines (the line IS the invoice line):
  // sold = Σ quantity×unitPrice; cost = Σ quantity×costPrice (where known);
  // profit = sold − cost; metersLaid = actual usage of "m"-unit lines.
  // Rejected lines and unapproved meerwerk never count as money.
  sales: {
    sold: number;
    cost: number;
    profit: number;
    metersLaid: number;
  };
};

// --- technician + foreman -------------------------------------------------
//
// The foreman gets the SAME money-free shape as the technician — the only
// difference is scope (projectScopeWhere: foreman sees every org project, a
// technician only assigned ones). `role` echoes which one it is so the client
// can still branch on it.

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
  /**
   * The werkbon to open when the row is tapped. Field staff cannot reach
   * /projects/:id (office-only), so the row must link to the werkbon itself.
   * Null when the project holds several relevant werkbonnen — there is no one
   * right target then, so the row simply is not a link.
   */
  workOrderId: string | null;
};

export type TechnicianDashboard = {
  role: "technician" | "foreman";
  /** The assigned work, earliest planned first, undated last. */
  projects: TechnicianProjectRow[];
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
  workOrderId?: string | null;
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
    workOrderId: p.workOrderId ?? null,
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
