import { api, type Page } from "../../lib/api/client";
import type { ActivityEntry } from "../../components/ActivityPanel";
import type { AttachmentItem } from "../../components/AttachmentsPanel";
import type { ProjectLifecycleStatus } from "@opero/shared";

// Projects — the grouping layer above werkbonnen. One project groups a
// customer's werkbonnen (each werkbon is billed + scheduled on its own).

export type ProjectStatus = "sales" | "operations" | "closing";
export type ProjectStage = "concept" | "in_progress" | "ready" | "done";
// Rollup only: "urgent" when any unfinished werkbon of the project is urgent.
// Urgency itself is per-werkbon; blocked is a separate flag (see `blocked`).
export type ProjectUrgency = "normal" | "urgent";
export type ProjectVisibility = "active" | "archived" | "all";

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
  createdAt: string;
  plannedDate?: string;
  status: ProjectStatus;
  lifecycleStatus: ProjectLifecycleStatus;
  stage: ProjectStage;
  archived: boolean;
  urgency: ProjectUrgency;
  // Derived from the project's blocker state — a separate axis from urgency.
  blocked: boolean;
  nextStepKey: string;
  workOrderCount: number;
  canArchive: boolean;
  value?: number;
};

// One werkbon summary as carried on the project detail.
export type ProjectWorkOrder = {
  id: string;
  ordinal: number;
  title: string;
  description?: string;
  taskNames?: string[];
  assigneeNames?: string[];
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
  contacts: { id: string; name: string; email?: string; phone?: string; role?: string }[];
  instructions?: string;
  description?: string;
  status: ProjectStatus;
  lifecycleStatus: ProjectLifecycleStatus;
  stage: ProjectStage;
  archived: boolean;
  urgency: ProjectUrgency;
  // Derived from the project's blocker state — a separate axis from urgency.
  blocked: boolean;
  value?: number;
  workOrders: ProjectWorkOrder[];
  activity: ActivityEntry[];
  attachments: AttachmentItem[];
};

// Editable project fields (create/update).
export type ProjectInput = {
  customerId: string;
  name?: string;
  /** The client's own order/PO number. Omitted when blank. */
  referenceNumber?: string;
  /** Site contact. Omitted when blank — the backend then seeds it from the customer. */
  contactName?: string;
  /** Contact persons from the customer's central list. */
  contactIds?: string[];
  /** Site address. Omitted → derived from location / the customer's address. */
  address?: string;
  postalCode?: string;
  city?: string;
  locationId?: string;
  notes?: string;
};

export function getProjectsPage(opts: {
  cursor?: string;
  search?: string;
  lifecycleStatus?: string;
  archived?: ProjectVisibility;
}): Promise<Page<ProjectSummary>> {
  return api.getPage<ProjectSummary>("/projects", {
    cursor: opts.cursor,
    search: opts.search,
    params: {
      lifecycleStatus: opts.lifecycleStatus,
      archived: opts.archived,
    },
  });
}

// Post a free-text note onto the project's timeline. Returns the refreshed
// feed, newest first.
export function addProjectComment(id: string, body: string): Promise<ActivityEntry[]> {
  return api.post<ActivityEntry[]>(`/projects/${id}/comments`, { body });
}

// Project-level files (PDF or image), visible from every werkbon in the
// project. Both mutations return the refreshed project.
export function uploadProjectAttachment(id: string, file: Blob): Promise<ProjectDetail> {
  return api.upload<ProjectDetail>(`/projects/${id}/attachments`, file);
}

export function deleteProjectAttachment(id: string, attachmentId: string): Promise<ProjectDetail> {
  return api.delete<ProjectDetail>(`/projects/${id}/attachments/${attachmentId}`);
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
    // Contact persons from the customer's central list (ids; full replace).
    contactIds: string[];
    // The job-site address. Editable after create; the create flow derives it
    // from the chosen customer location instead.
    address: string;
    postalCode: string;
    city: string;
    description: string;
    instructions: string;
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

export function archiveProject(id: string): Promise<ProjectDetail> {
  return api.post<ProjectDetail>(`/projects/${id}/archive`, {});
}

export function restoreProject(id: string): Promise<ProjectDetail> {
  return api.post<ProjectDetail>(`/projects/${id}/restore`, {});
}

// Create a new werkbon under this project (from the project detail screen).
export function createWorkOrderForProject(projectId: string): Promise<{ id: string }> {
  return api.post<{ id: string }>("/work-orders", { projectId });
}

// Delete a single werkbon (from the project detail screen). Admin only.
export function deleteWorkOrder(workOrderId: string): Promise<void> {
  return api.delete<void>(`/work-orders/${workOrderId}`);
}
