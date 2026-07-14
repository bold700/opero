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

export type WorkOrder = {
  id: string;
  projectId: string;
  title: string;
  drawings: PhotoRef[];
  approvedBySupervisor: boolean;
  ordinal: number;
  // Pre-job check + dispatch gate.
  prejobCheck: Record<string, boolean>;
  prejobPhotos: PhotoRef[];
  prejobComplete: boolean;
  canDispatch: boolean;
  dispatchedAt?: string;
  // Per-work-order sign-off. signedAt set → this work order is signed and locked.
  signature?: string;
  signatureUrl?: string;
  signedAt?: string;
  signedByName?: string;
  // The monteur assigned to this werkbon (werkbon-level, one per job).
  assigneeId?: string;
  assigneeName?: string;
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
  unitPrice?: number;
  amount?: number;
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
  insulationType: string;
  stage: string;
  status: string;
  urgency: string;
  nextStepKey: string;
  value?: number;
  extraWork: ExtraWork[];
  activity: Activity[];
};

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

// Assign (or clear with null) the werkbon's monteur. Werkbon-level: one person
// does one job, so this lives on the header, not per-zone.
export function setWorkOrderAssignee(
  workOrderId: string,
  assigneeId: string | null,
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}`, { assigneeId });
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

// Update an invoice-line row inline: quantity, description (`label`), or switch
// the catalog variant (`variantId` → name/unit/price/cost/diameter re-resolve
// server-side; the client never sends a price). Omit a field to leave it.
export function updateMaterial(
  workOrderId: string,
  matId: string,
  patch: {
    variantId?: string | null;
    label?: string | null;
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

// --- Pre-job check + dispatch ---------------------------------------------

export function setPrejobCheck(
  workOrderId: string,
  key: string,
  done: boolean,
): Promise<WorkOrder> {
  return api.patch<WorkOrder>(`/work-orders/${workOrderId}/prejob-check`, { key, done });
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

// --- Extra work (project mutations) ---------------------------------------

export type NewExtraWork = {
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  label?: string;
};

export function reportExtraWork(
  projectId: string,
  input: NewExtraWork,
): Promise<unknown> {
  return api.post(`/projects/${projectId}/extra-work`, input);
}

export function approveOffice(projectId: string, mwId: string): Promise<unknown> {
  return api.post(`/projects/${projectId}/extra-work/${mwId}/approve-office`, {});
}

export function approveClient(projectId: string, mwId: string): Promise<unknown> {
  return api.post(`/projects/${projectId}/extra-work/${mwId}/approve-client`, {});
}

export function rejectExtraWork(projectId: string, mwId: string): Promise<unknown> {
  return api.post(`/projects/${projectId}/extra-work/${mwId}/reject`, {});
}

export function uploadExtraWorkPhoto(
  projectId: string,
  mwId: string,
  file: Blob,
): Promise<unknown> {
  return api.upload(`/projects/${projectId}/extra-work/${mwId}/photo`, file);
}

export function deleteExtraWorkPhoto(
  projectId: string,
  mwId: string,
  key: string,
): Promise<unknown> {
  return api.delete(`/projects/${projectId}/extra-work/${mwId}/photo`, { photo: key });
}
