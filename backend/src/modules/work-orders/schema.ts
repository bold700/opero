import { z } from "zod";
import { workOrderStatusIds } from "@opero/shared";

// Local zod schemas for the work-orders module — not shared.
// Mirror the Zustand store's workOrder actions. Text is clamped in the handlers
// (clampText/clampNumber), so these keep validation light.

// POST /work-orders — create a workOrder under a project.
export const createWorkOrderSchema = z.object({
  projectId: z.string().min(1),
  // Multiple visit contacts; optional because the office may not know any yet.
  contactPersonIds: z.array(z.string().min(1)).optional(),
  // Backward-compatible singular input for older integrations.
  contactPersonId: z.string().min(1).optional(),
  title: z.string().optional(),
  // Optional per-visit description, set straight from the create dialog.
  description: z.string().optional(),
});

// PATCH /work-orders/:id — header fields. assigneeIds sets the werkbon's
// monteur(s) — a full replace of the assigned crew (empty array clears them);
// all ids are validated against the org in the handler.
// Slot times on the planning calendar ("08:00"). Not nullable: a PlanningItem
// always has times (defaults 08:00–15:30), so a time can be moved but not
// cleared — clearing the DATE is what unschedules.
const slotTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

export const updateWorkOrderSchema = z
  .object({
    title: z.string().optional(),
    // This visit's OWN description (the project's is edited on the project).
    description: z.string().optional(),
    assigneeIds: z.array(z.string()).optional(),
    contactPersonIds: z.array(z.string()).optional(),
    // The werkbon is the scheduled visit — its date(s) live here.
    plannedDate: z.string().nullable().optional(),
    plannedEndDate: z.string().nullable().optional(),
    // THIS visit's priority (per-werkbon; feeds its own listStatus).
    urgency: z.enum(["normal", "urgent"]).optional(),
    // The visit's start/end time. Written to the werkbon's calendar slot via
    // the shared planning service, same store the Planning screen edits.
    startTime: slotTimeSchema.optional(),
    endTime: slotTimeSchema.optional(),
    // Per-werkbon: does dispatch require a pre-job photo? (default: not required)
    prejobPhotoRequired: z.boolean().optional(),
  })
  // Only checkable when both are in the patch; the route re-checks against the
  // stored slot for a one-sided time change.
  .refine((v) => !v.startTime || !v.endTime || v.startTime < v.endTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const setWorkOrderStatusSchema = z.object({
  status: z.enum(workOrderStatusIds),
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

// POST /work-orders/:id/tasks/:taskId/materials/from-article — add a line from
// the ARTICLE catalog (other products & services, e.g. labour hours). Same
// server-side resolution rule as from-catalog.
export const addMaterialFromArticleSchema = z.object({
  articleId: z.string().min(1),
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
  requirementDone: z.boolean().optional(),
  done: z.boolean().optional(),
  note: z.string().nullable().optional(),
  isExtraWork: z.boolean().optional(),
});

// POST /work-orders/:id/materials/:matId/usage — mirror setMaterialUsage.
// Stock registration on one line. All fields optional — register whichever
// number is known (issued at hand-out, used/returned at the end of the job).
export const usageSchema = z
  .object({
    used: z.number().min(0).optional(),
    issued: z.number().min(0).optional(),
    returned: z.number().min(0).optional(),
  })
  .refine((v) => v.used !== undefined || v.issued !== undefined || v.returned !== undefined, {
    message: "At least one of used/issued/returned is required",
  });

// POST /work-orders/:id/materials/:matId/progress — one day's progress on a
// line, in the line's own unit. `day` defaults to today server-side.
export const progressSchema = z.object({
  amount: z.number().positive(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// Manual operational packing-list item. It is intentionally separate from a
// billable TaskMaterial line: adding a drill must never affect the quote.
export const addWorkOrderRequirementSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["material", "tool"]),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().max(40).optional(),
});

export const updateWorkOrderRequirementSchema = z.object({
  done: z.boolean(),
});

// POST /work-orders/:id/finish — mirror finishWorkOrder (signature required).
export const finishSchema = z.object({
  signature: z.string().min(1),
});
