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

export function getAssignableEmployees(): Promise<AssigneeOption[]> {
  return api.get<AssigneeOption[]>("/work-orders/assignable");
}

export type WorkOrderAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  createdAt: string;
};

export type WorkOrder = {
  id: string;
  projectId: string;
  title: string;
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
  // The werkbon is the scheduled visit — its own date(s), possibly multi-day.
  plannedDate?: string;
  plannedEndDate?: string;
  // Extra work (meerwerk) is billed per-werkbon, so it lives on the werkbon.
  extraWork: ExtraWork[];
  tasks: WorkOrderTask[];
};

// --- Project context (GET /projects/:id) ----------------------------------
// We pull the parent project for the header (customer, status) plus the
// extra-work + activity panels, which live on the project.

export type ExtraWork = {
  id: string;
  description: string;
  label?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  diameter?: number;
  // Set when the item was picked from the catalog (null for free-text meerwerk).
  variantId?: string;
  // Material + size of the current variant — for the edit dialog's prefill.
  variantMaterialId?: string;
  variantSize?: string;
  unitPrice?: number;
  amount?: number;
  // Admin-only (canSeeMargin), like task lines.
  costPrice?: number;
  margin?: number;
  photos: PhotoRef[];
  createdAt: string;
  done: boolean;
  approvedByOffice: boolean;
  approvedByClient: boolean;
  rejected: boolean;
  rejectedBy?: string;
};

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
  extraWork: ExtraWork[];
  activity: Activity[];
};

// Fields the werkbon-detail project sidebar can edit (all project-level).
export type ProjectSidebarPatch = {
  urgency?: "normal" | "urgent" | "blocked";
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

// Download the work order as a PDF. Fetches the blob (with auth) and triggers a
// browser download. `filename` is the suggested save name.
export async function exportWorkOrderPdf(id: string, filename: string): Promise<void> {
  const blob = await api.download(`/work-orders/${id}/pdf`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Download the work order as a customer-facing quote (offerte) PDF — admin
// only (403 otherwise). Same blob-download flow as exportWorkOrderPdf.
export async function exportWorkOrderQuotePdf(id: string, filename: string): Promise<void> {
  const blob = await api.download(`/work-orders/${id}/quote-pdf`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getProject(id: string): Promise<Project> {
  return api.get<Project>(`/projects/${id}`);
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

// Set the werkbon's schedule (the visit's date(s)). Scheduling is per-werkbon.
export function setWorkOrderSchedule(
  workOrderId: string,
  patch: { plannedDate?: string | null; plannedEndDate?: string | null },
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, patch);
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
  input: { variantId: string; quantity: number },
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
  input: { name: string; quantity: number; unit: string; unitPrice?: number },
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

// --- Extra work (project mutations) ---------------------------------------

export type NewExtraWork = {
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  label?: string;
};

// Extra work (meerwerk) is per-WERKBON now — all these target the work order.
export function reportExtraWork(
  workOrderId: string,
  input: NewExtraWork,
): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/extra-work`, input);
}

// Report meerwerk picked from the materials catalog — only the variant + qty go
// up; name/unit/price resolve server-side (technician can't inject a price).
export function reportExtraWorkFromCatalog(
  workOrderId: string,
  input: { variantId: string; quantity: number },
): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/extra-work/from-catalog`, input);
}

// Edit an existing meerwerk row. `variantId` re-points it at a catalog variant
// (price re-resolves server-side); the free-text fields edit an uncatalogued
// row. A technician's `unitPrice` is discarded server-side (admin-only).
export function updateExtraWork(
  workOrderId: string,
  mwId: string,
  patch: {
    variantId?: string | null;
    name?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
  },
): Promise<unknown> {
  return api.patch(`/work-orders/${workOrderId}/extra-work/${mwId}`, patch);
}

export function approveOffice(workOrderId: string, mwId: string): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/extra-work/${mwId}/approve-office`, {});
}

export function approveClient(workOrderId: string, mwId: string): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/extra-work/${mwId}/approve-client`, {});
}

export function rejectExtraWork(workOrderId: string, mwId: string): Promise<unknown> {
  return api.post(`/work-orders/${workOrderId}/extra-work/${mwId}/reject`, {});
}

export function uploadExtraWorkPhoto(
  workOrderId: string,
  mwId: string,
  file: Blob,
): Promise<unknown> {
  return api.upload(`/work-orders/${workOrderId}/extra-work/${mwId}/photo`, file);
}

export function deleteExtraWorkPhoto(
  workOrderId: string,
  mwId: string,
  key: string,
): Promise<unknown> {
  return api.delete(`/work-orders/${workOrderId}/extra-work/${mwId}/photo`, { photo: key });
}
