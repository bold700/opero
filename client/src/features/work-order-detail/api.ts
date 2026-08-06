import { api } from "../../lib/api/client";

// A stored photo/drawing: portable `key` (for delete) + renderable `url`.
export type PhotoRef = { key: string; url: string };

// --- Work order (GET /work-orders/:id) ------------------------------------
// Mirrors backend workOrderDto. Prices (unitPrice) are stripped server-side
// for technician/client, so they're optional here.

export type WorkOrderMaterial = {
  id: string;
  taskId: string;
  label?: string;
  name: string;
  quantity: number;
  usedQuantity?: number;
  unit: string;
  diameter?: number;
  // Set when the line was picked from the materials catalog.
  variantId?: string;
  // Material + size of the current variant — only for the edit dialog to
  // pre-select the article (no price data).
  variantMaterialId?: string;
  variantSize?: string;
  // Selling price (verkoopprijs). Present for admin + client; stripped for
  // technicians. Cost/margin below are ADMIN-ONLY (canSeeMargin).
  unitPrice?: number;
  costPrice?: number;
  margin?: number; // (sell − cost) × qty
  marginPct?: number; // margin as % of the selling total
  onSite: boolean;
  done: boolean;
  note?: string;
  ordinal: number;
  // --- Meerwerk (extra work) ------------------------------------------------
  // A line the customer didn't originally buy. It never counts toward the quote,
  // and only reaches the invoice once BOTH office and client have approved it.
  // The approval fields are only present when isExtraWork.
  isExtraWork: boolean;
  approvedByOffice?: boolean;
  approvedByClient?: boolean;
  rejected?: boolean;
  rejectedBy?: "office" | "client";
  photos?: PhotoRef[];
};

export type WorkOrderTask = {
  id: string;
  workOrderId: string;
  description: string;
  done: boolean;
  day?: string;
  // Per-zone work type + assigned technician.
  workTypeId?: string;
  workTypeName?: string;
  assigneeId?: string;
  assigneeName?: string;
  beforePhotos: PhotoRef[];
  resultPhotos: PhotoRef[];
  startedAt?: string;
  endedAt?: string;
  hours?: number;
  note?: string;
  ordinal: number;
  materials: WorkOrderMaterial[];
};

// Dropdown sources for per-task work type + assignee.
export type WorkTypeOption = { id: string; name: string };
export type AssigneeOption = { id: string; name: string };

export function getWorkTypes(): Promise<WorkTypeOption[]> {
  return api.get<WorkTypeOption[]>("/materials/work-types");
}

// Assignable staff. `role` narrows the list by job title so a picker only
// offers people eligible for that slot; omit it for the unfiltered list.
// Employees with no job title set are always included by the backend, so
// filtering can never leave a picker empty.
export type AssignableRole = "project_leader" | "technician";

export function getAssignableEmployees(
  role?: AssignableRole,
): Promise<AssigneeOption[]> {
  const suffix = role ? `?role=${role}` : "";
  return api.get<AssigneeOption[]>(`/work-orders/assignable${suffix}`);
}

export type WorkOrderAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  createdAt: string;
};

// One of the customer's contact people (the multi-contact list on the customer
// record). Everything but the name is optional.
export type CustomerContactPerson = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

// The customer's contact details, carried on the werkbon so a monteur on site
// can reach someone without leaving the screen. Read-only — the customer record
// is edited under /customers.
export type WorkOrderCustomer = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  contactPersons: CustomerContactPerson[];
};

export type WorkOrder = {
  id: string;
  projectId: string;
  title: string;
  // THIS visit's own description ("2e verdieping, week 38"), independent of the
  // project's — a project groups many werkbonnen.
  description?: string;
  // The customer's contact details (phone/email + contact people).
  customer?: WorkOrderCustomer;
  drawings: PhotoRef[];
  // Job-level uploaded documents (PDFs/images) — quotes, plans, permits.
  attachments: WorkOrderAttachment[];
  approvedBySupervisor: boolean;
  ordinal: number;
  // Pre-job check + dispatch gate. `prejobItems` = THIS werkbon's own items
  // (snapshotted from the org template at creation, editable on the werkbon).
  prejobItems: { id: string; key: string; label: string; done: boolean; ordinal: number }[];
  prejobCheck: Record<string, boolean>;
  prejobPhotos: PhotoRef[];
  // Per-werkbon: does dispatch require a pre-job photo? (default false)
  prejobPhotoRequired: boolean;
  prejobComplete: boolean;
  canDispatch: boolean;
  dispatchedAt?: string;
  // Per-work-order sign-off. signedAt set → this work order is signed and locked.
  signature?: string;
  signatureUrl?: string;
  signedAt?: string;
  signedByName?: string;
  // The monteur(s) assigned to this werkbon (werkbon-level; a crew per job).
  assignees: { id: string; name: string }[];
  // The werkbon is the scheduled visit — its own date(s), possibly multi-day,
  // plus the visit's times from its calendar slot ("08:00"). Present once the
  // werkbon is scheduled (a slot always carries times, defaults 08:00–15:30).
  plannedDate?: string;
  plannedEndDate?: string;
  startTime?: string;
  endTime?: string;
  tasks: WorkOrderTask[];
};

// --- Project context (GET /projects/:id) ----------------------------------
// We pull the parent project for the header (customer, status) and the
// activity panel, which live on the project.

export type Activity = {
  id: string;
  projectId: string;
  userId?: string;
  userName?: string;
  type: string;
  // System/status/scheduled events: a messageKey + params for i18n.
  // Comments: free user text in `body`.
  messageKey?: string;
  params?: Record<string, unknown>;
  body?: string;
  fromStatus?: string;
  toStatus?: string;
  createdAt: string;
};

export type Project = {
  id: string;
  projectNumber: string;
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
  insulationType: string;
  workTypeId?: string;
  workTypeName?: string;
  stage: string;
  status: string;
  urgency: string;
  plannedDate?: string;
  plannedEndDate?: string;
  projectLeaderId?: string;
  installerIds: string[];
  nextStepKey: string;
  value?: number;
  activity: Activity[];
};

// Fields the werkbon-detail project sidebar can edit (all project-level).
export type ProjectSidebarPatch = {
  urgency?: "normal" | "urgent" | "blocked";
  // Switch the job to another customer. This MOVES it between client portals
  // (project.customerId gates client access), so confirm before sending.
  customerId?: string;
  // NOTE: scheduling (plannedDate) is per-werkbon → setWorkOrderSchedule, not here.
  projectLeaderId?: string | null;
  installerIds?: string[];
  workTypeId?: string | null;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  instructions?: string;
};

export function updateProject(projectId: string, patch: ProjectSidebarPatch): Promise<Project> {
  return api.patch<Project>(`/projects/${projectId}`, patch);
}

export function getWorkOrder(id: string): Promise<WorkOrder> {
  return api.get<WorkOrder>(`/work-orders/${id}`);
}

// Delete the whole werkbon (admin-only server-side). Cascades to its zones,
// lines, photos and billing — the caller must confirm first.
export function deleteWorkOrder(id: string): Promise<void> {
  return api.delete<void>(`/work-orders/${id}`);
}

// Fetch a document (with auth) and hand it to the browser as a download.
// Prefers the server's Content-Disposition filename — it carries the canonical
// document identity (e.g. the assigned offerte number) — and falls back to the
// caller's name when the header is missing.
async function downloadDocument(path: string, fallbackFilename: string): Promise<void> {
  const { blob, filename } = await api.downloadWithName(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Download the work order as a PDF. `filename` is the fallback save name.
export function exportWorkOrderPdf(id: string, filename: string): Promise<void> {
  return downloadDocument(`/work-orders/${id}/pdf`, filename);
}

// Download the work order as a customer-facing quote (offerte) PDF — office
// only (403 otherwise). Same blob-download flow as exportWorkOrderPdf.
export function exportWorkOrderQuotePdf(id: string, filename: string): Promise<void> {
  return downloadDocument(`/work-orders/${id}/quote-pdf`, filename);
}

export function getProject(id: string): Promise<Project> {
  return api.get<Project>(`/projects/${id}`);
}

// Lighter than refetching the whole project: just the activity feed, newest
// first. Used to keep the ActivityPanel live after every mutation without
// re-pulling customer/address/etc. that didn't change.
export function getProjectActivity(projectId: string): Promise<Activity[]> {
  return api.get<Activity[]>(`/projects/${projectId}/activity`);
}

// --- Tasks (work-order mutations) -----------------------------------------

export function addTask(workOrderId: string): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/tasks`, {});
}

// Set the werkbon's monteur crew (full replace; empty clears). Werkbon-level —
// a job can be split across a crew — so this lives on the header, not per-zone.
export function setWorkOrderAssignees(
  workOrderId: string,
  assigneeIds: string[],
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, { assigneeIds });
}

// Set the werkbon's schedule (the visit's date(s) and/or times). Scheduling is
// per-werkbon; times write to its calendar slot via the shared planning
// service, so the Planning screen and this detail can never disagree.
export function setWorkOrderSchedule(
  workOrderId: string,
  patch: {
    plannedDate?: string | null;
    plannedEndDate?: string | null;
    startTime?: string;
    endTime?: string;
  },
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, patch);
}

// Rename the werkbon. An empty title is allowed — the header then falls back to
// "Werkbon N" (its ordinal), so the werkbon is never left nameless.
export function setWorkOrderTitle(workOrderId: string, title: string): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, { title });
}

// Set THIS visit's own description. Blanking it is valid — the printed werkbon
// then falls back to the project's description.
export function setWorkOrderDescription(
  workOrderId: string,
  description: string,
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, { description });
}

export function updateTask(
  workOrderId: string,
  taskId: string,
  patch: {
    description?: string;
    note?: string;
    day?: string;
    workTypeId?: string | null;
    assigneeId?: string | null;
  },
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}/tasks/${taskId}`, patch);
}

export function deleteTask(workOrderId: string, taskId: string): Promise<WorkOrder> {
  return api.delete<WorkOrder>(`/work-orders/${workOrderId}/tasks/${taskId}`);
}

// Reorder zones by drag: move `activeTaskId` into `overTaskId`'s slot. The
// backend renumbers every zone's ordinal in one transaction.
export function reorderTasks(
  workOrderId: string,
  activeTaskId: string,
  overTaskId: string,
): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/tasks/reorder`, {
    activeTaskId,
    overTaskId,
  });
}

export function toggleTask(workOrderId: string, taskId: string): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/tasks/${taskId}/toggle`, {});
}

// --- Materials (work-order mutations) -------------------------------------

// Add a line from the materials catalog. Only the variant id + quantity go
// up — name/unit/unitPrice/diameter resolve server-side (technicians' own
// responses have prices stripped, so the server owns the price).
export function addMaterialFromCatalog(
  workOrderId: string,
  taskId: string,
  input: { variantId: string; quantity: number; isExtraWork?: boolean },
): Promise<WorkOrder> {
  return api.post<WorkOrder>(
    `/work-orders/${workOrderId}/tasks/${taskId}/materials/from-catalog`,
    input,
  );
}

// Add a CUSTOM (free-text) line: description, quantity and unit typed by hand,
// for miscellaneous material that isn't in the catalog. `unitPrice` is optional
// — omit it to leave the line unpriced for the office to fill in later. The
// route is admin-only server-side, so this is never reachable as a technician.
export function addCustomMaterial(
  workOrderId: string,
  taskId: string,
  input: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    isExtraWork?: boolean;
  },
): Promise<WorkOrder> {
  return api.post<WorkOrder>(
    `/work-orders/${workOrderId}/tasks/${taskId}/materials`,
    input,
  );
}

// Update an invoice-line row inline: quantity, description (`label`/`name`),
// unit, price, or switch the catalog variant (`variantId` → name/unit/price/
// cost/diameter re-resolve server-side and any sent price is ignored). Omit a
// field to leave it. name/unit/unitPrice are for FREE-TEXT lines, where there
// is no variant to resolve from; the backend rejects them from non-admins.
export function updateMaterial(
  workOrderId: string,
  matId: string,
  patch: {
    variantId?: string | null;
    label?: string | null;
    name?: string;
    unit?: string;
    unitPrice?: number | null;
    quantity?: number;
    diameter?: number | null;
    isExtraWork?: boolean;
  },
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}/materials/${matId}`, patch);
}

export function deleteMaterial(workOrderId: string, matId: string): Promise<WorkOrder> {
  return api.delete<WorkOrder>(`/work-orders/${workOrderId}/materials/${matId}`);
}

export function toggleMaterial(workOrderId: string, matId: string): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/materials/${matId}/toggle`, {});
}

// --- Task photos (real upload) --------------------------------------------

export function uploadTaskPhoto(
  workOrderId: string,
  taskId: string,
  kind: "before" | "result",
  file: Blob,
): Promise<WorkOrder> {
  return api.upload<WorkOrder>(
    `/work-orders/${workOrderId}/tasks/${taskId}/photos/${kind}`,
    file,
  );
}

export function deleteTaskPhoto(
  workOrderId: string,
  taskId: string,
  photoKey: string,
): Promise<WorkOrder> {
  return api.delete<WorkOrder>(
    `/work-orders/${workOrderId}/tasks/${taskId}/photos`,
    { photo: photoKey },
  );
}

// --- Drawings (image or PDF) ----------------------------------------------

export function uploadDrawing(workOrderId: string, file: Blob): Promise<WorkOrder> {
  return api.upload<WorkOrder>(`/work-orders/${workOrderId}/drawings`, file);
}

export function deleteDrawing(workOrderId: string, key: string): Promise<WorkOrder> {
  return api.delete<WorkOrder>(`/work-orders/${workOrderId}/drawings`, { photo: key });
}

// --- Attachments (job-level PDFs / images) --------------------------------

export function uploadAttachment(workOrderId: string, file: Blob): Promise<WorkOrder> {
  return api.upload<WorkOrder>(`/work-orders/${workOrderId}/attachments`, file);
}

export function deleteAttachment(workOrderId: string, attachmentId: string): Promise<WorkOrder> {
  return api.delete<WorkOrder>(`/work-orders/${workOrderId}/attachments/${attachmentId}`);
}

// --- Pre-job checklist (per werkbon) + dispatch ---------------------------

// Tick/untick or rename one of THIS werkbon's checklist items (admin only).
export function updatePrejobItem(
  workOrderId: string,
  itemId: string,
  input: { done?: boolean; label?: string },
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}/prejob-items/${itemId}`, input);
}

// Add a one-off checklist item to THIS werkbon (admin only).
export function addPrejobItem(workOrderId: string, label: string): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/prejob-items`, { label });
}

export function reorderPrejobItems(workOrderId: string, orderedIds: string[]): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/prejob-items/reorder`, { orderedIds });
}

export function deletePrejobItem(workOrderId: string, itemId: string): Promise<WorkOrder> {
  return api.delete<WorkOrder>(`/work-orders/${workOrderId}/prejob-items/${itemId}`);
}

// Toggle the per-werkbon "require a pre-job photo" dispatch gate (admin only).
export function setPrejobPhotoRequired(
  workOrderId: string,
  required: boolean,
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, { prejobPhotoRequired: required });
}

export function uploadPrejobPhoto(workOrderId: string, file: Blob): Promise<WorkOrder> {
  return api.upload<WorkOrder>(`/work-orders/${workOrderId}/prejob-photos`, file);
}

export function deletePrejobPhoto(workOrderId: string, key: string): Promise<WorkOrder> {
  return api.delete<WorkOrder>(`/work-orders/${workOrderId}/prejob-photos`, { photo: key });
}

export function dispatchWorkOrder(workOrderId: string): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/dispatch`, {});
}

// --- Sign-off -------------------------------------------------------------

// Sign off with a drawn signature image (PNG blob) + the signer's typed name.
export function finishWorkOrder(
  workOrderId: string,
  signatureImage: Blob,
  signedByName: string,
): Promise<WorkOrder> {
  return api.upload<WorkOrder>(`/work-orders/${workOrderId}/finish`, signatureImage, {
    signedByName,
  });
}

// Undo a sign-off (admin-only): clears the signature and re-unlocks the
// werkbon for editing.
export function reopenWorkOrder(workOrderId: string): Promise<WorkOrder> {
  return api.post<WorkOrder>(`/work-orders/${workOrderId}/reopen`, {});
}

// --- Meerwerk (extra work) -------------------------------------------------
//
// Meerwerk is a TaskMaterial line with `isExtraWork` set, so CREATING and
// EDITING it goes through the normal line endpoints (addTaskLine /
// addCustomTaskLine / updateMaterial with `isExtraWork: true`). Only the
// approval lifecycle and its photo evidence are meerwerk-specific.

export function approveOffice(workOrderId: string, matId: string): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/materials/${matId}/approve-office`, {});
}

export function approveClient(workOrderId: string, matId: string): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/materials/${matId}/approve-client`, {});
}

export function rejectExtraWork(workOrderId: string, matId: string): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/materials/${matId}/reject`, {});
}

export function uploadExtraWorkPhoto(
  workOrderId: string,
  matId: string,
  file: Blob,
): Promise<unknown> {
  return api.upload(`/work-orders/${workOrderId}/materials/${matId}/photo`, file);
}

export function deleteExtraWorkPhoto(
  workOrderId: string,
  matId: string,
  key: string,
): Promise<unknown> {
  return api.delete(`/work-orders/${workOrderId}/materials/${matId}/photo`, { photo: key });
}
