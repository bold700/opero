import { z } from "zod";

// Local zod schemas for the work-orders module — not shared.
// Mirror the Zustand store's workOrder actions. Text is clamped in the handlers
// (clampText/clampNumber), so these keep validation light.

// POST /work-orders — create a workOrder under a project.
export const createWorkOrderSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().optional(),
});

// PATCH /work-orders/:id — header fields. assigneeIds sets the werkbon's
// monteur(s) — a full replace of the assigned crew (empty array clears them);
// all ids are validated against the org in the handler.
export const updateWorkOrderSchema = z.object({
  title: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  // The werkbon is the scheduled visit — its date(s) live here.
  plannedDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  // Per-werkbon: does dispatch require a pre-job photo? (default: not required)
  prejobPhotoRequired: z.boolean().optional(),
});

// PATCH /work-orders/:id/tasks/:taskId — task fields incl. per-zone work type +
// assignee (nullable: pass null to clear, omit to leave unchanged).
export const updateTaskSchema = z.object({
  description: z.string().optional(),
  day: z.string().nullable().optional(),
  done: z.boolean().optional(),
  note: z.string().nullable().optional(),
  workTypeId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});

// POST /work-orders/:id/tasks/reorder — mirror reorderWorkOrderTasks.
export const reorderTasksSchema = z.object({
  activeTaskId: z.string().min(1),
  overTaskId: z.string().min(1),
});

// PATCH /work-orders/:id/tasks/:taskId/hours — mirror setTaskHours.
export const taskHoursSchema = z.object({
  hours: z.number(),
});

// DELETE /work-orders/:id/tasks/:taskId/photos — remove a specific photo.
export const removePhotoSchema = z.object({
  photo: z.string().min(1),
});

// POST /work-orders/:id/tasks/:taskId/materials — add blank OR seeded line
// (mirror addTaskMaterial / addTaskLine). All fields optional → blank row.
export const addMaterialSchema = z
  .object({
    name: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().optional(),
    diameter: z.number().optional(),
    label: z.string().optional(),
    // Meerwerk: work the customer didn't buy. Changes who may add the line
    // (technicians may report meerwerk, not sold scope) and when it counts as
    // money (only after office + client approval).
    isExtraWork: z.boolean().optional(),
  })
  .optional();

// POST /work-orders/:id/tasks/:taskId/materials/from-catalog — add a line from
// the materials catalog. Price/name/unit resolve SERVER-side (the requester
// may be a technician whose API responses have prices stripped).
export const addMaterialFromCatalogSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().positive().optional(),
  isExtraWork: z.boolean().optional(),
});

// POST /work-orders/:id/materials/:matId/reject — who rejected the meerwerk.
export const rejectMeerwerkSchema = z.object({
  by: z.enum(["office", "client"]).optional(),
});

// PATCH /work-orders/:id/materials/:matId — mirror updateTaskMaterial patch.
// `variantId` re-points the line at a different catalog variant: name / unit /
// unitPrice / costPrice / diameter re-resolve SERVER-side (never trust a
// client-supplied price — the requester may be a technician). Client-supplied
// unitPrice is ignored when variantId is present.
export const updateMaterialSchema = z.object({
  variantId: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  name: z.string().optional(),
  quantity: z.number().optional(),
  usedQuantity: z.number().nullable().optional(),
  unit: z.string().optional(),
  diameter: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  onSite: z.boolean().optional(),
  done: z.boolean().optional(),
  note: z.string().nullable().optional(),
  isExtraWork: z.boolean().optional(),
});

// POST /work-orders/:id/materials/:matId/usage — mirror setMaterialUsage.
export const usageSchema = z.object({
  used: z.number(),
});

// POST /work-orders/:id/finish — mirror finishWorkOrder (signature required).
export const finishSchema = z.object({
  signature: z.string().min(1),
});
