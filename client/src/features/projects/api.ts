import { api, type Page } from "../../lib/api/client";

// Projects — the grouping layer above werkbonnen. One project groups a
// customer's werkbonnen (each werkbon is billed + scheduled on its own).

export type ProjectStatus = "sales" | "operations" | "closing";
export type ProjectStage = "concept" | "in_progress" | "ready" | "done";
export type ProjectUrgency = "normal" | "urgent" | "blocked";

// Mirrors backend projectSummaryDto (list row).
export type ProjectSummary = {
  id: string;
  projectNumber: string;
  /** The CLIENT's own reference (their order/PO number) — not projectNumber. */
  referenceNumber?: string;
  name?: string;
  customerId: string;
  customerName: string;
  city: string;
  status: ProjectStatus;
  stage: ProjectStage;
  urgency: ProjectUrgency;
  nextStepKey: string;
  workOrderCount: number;
  value?: number;
};

// One werkbon summary as carried on the project detail.
export type ProjectWorkOrder = {
  id: string;
  ordinal: number;
  title: string;
  status: string;
  plannedDate?: string;
  signed: boolean;
  value?: number;
};

// Mirrors the fields of backend projectDto we use on the detail screen.
export type ProjectDetail = {
  id: string;
  projectNumber: string;
  /**
   * The CLIENT's own reference for this job (their order/PO/dossier number).
   * Distinct from projectNumber, which is Opero's internal identity.
   */
  referenceNumber?: string;
  name?: string;
  customerId: string;
  customerName: string;
  address: string;
  postalCode: string;
  city: string;
  contactName?: string;
  contactPhone?: string;
  instructions?: string;
  description?: string;
  workTypeId?: string;
  workTypeName?: string;
  status: ProjectStatus;
  stage: ProjectStage;
  urgency: ProjectUrgency;
  value?: number;
  workOrders: ProjectWorkOrder[];
};

// Editable project fields (create/update).
export type ProjectInput = {
  customerId: string;
  name?: string;
  /** The client's own order/PO number. Omitted when blank. */
  referenceNumber?: string;
  /** Site contact. Omitted when blank — the backend then seeds it from the customer. */
  contactName?: string;
  contactPhone?: string;
  locationId?: string;
  workTypeId?: string;
  notes?: string;
};

export function getProjectsPage(opts: {
  cursor?: string;
  search?: string;
}): Promise<Page<ProjectSummary>> {
  return api.getPage<ProjectSummary>("/projects", { cursor: opts.cursor, search: opts.search });
}

export function getProject(id: string): Promise<ProjectDetail> {
  return api.get<ProjectDetail>(`/projects/${id}`);
}

export function createProject(input: ProjectInput): Promise<{ id: string }> {
  return api.post<{ id: string }>("/projects", input);
}

export function updateProject(
  id: string,
  patch: Partial<{
    name: string;
    // The client's own order/PO number. "" clears it server-side.
    referenceNumber: string;
    contactName: string;
    contactPhone: string;
    // The job-site address. Editable after create; the create flow derives it
    // from the chosen customer location instead.
    address: string;
    postalCode: string;
    city: string;
    description: string;
    instructions: string;
    workTypeId: string | null;
    // Reassign the job to another customer. This MOVES it between client
    // portals (project.customerId gates client access), so confirm first.
    customerId: string;
  }>,
): Promise<ProjectDetail> {
  return api.patch<ProjectDetail>(`/projects/${id}`, patch);
}

export function deleteProject(id: string): Promise<void> {
  return api.delete<void>(`/projects/${id}`);
}

// Create a new werkbon under this project (from the project detail screen).
export function createWorkOrderForProject(projectId: string): Promise<{ id: string }> {
  return api.post<{ id: string }>("/work-orders", { projectId });
}

// Delete a single werkbon (from the project detail screen). Admin only.
export function deleteWorkOrder(workOrderId: string): Promise<void> {
  return api.delete<void>(`/work-orders/${workOrderId}`);
}
