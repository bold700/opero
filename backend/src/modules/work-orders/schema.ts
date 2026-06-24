import { z } from "zod";

// Local zod schemas for the work-orders (werkbonnen) module — not shared.
// Mirror the Zustand store's werkbon actions. Text is clamped in the handlers
// (clampText/clampNumber), so these keep validation light.

// POST /work-orders — create a werkbon under a project.
export const createWerkbonSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().optional(),
});

// PATCH /work-orders/:id — header fields (title only for now).
export const updateWerkbonSchema = z.object({
  title: z.string().optional(),
});

// PATCH /work-orders/:id/tasks/:taskId — mirror updateWerkbonTask's patch shape.
export const updateTaskSchema = z.object({
  description: z.string().optional(),
  day: z.string().nullable().optional(),
  done: z.boolean().optional(),
  note: z.string().nullable().optional(),
});

// POST /work-orders/:id/tasks/reorder — mirror reorderWerkbonTasks.
export const reorderTasksSchema = z.object({
  activeTaskId: z.string().min(1),
  overTaskId: z.string().min(1),
});

// PATCH /work-orders/:id/tasks/:taskId/hours — mirror setTaakHours.
export const taskHoursSchema = z.object({
  hours: z.number(),
});

// DELETE /work-orders/:id/tasks/:taskId/photos — remove a specific photo.
export const removePhotoSchema = z.object({
  photo: z.string().min(1),
});

// POST /work-orders/:id/tasks/:taskId/materials — add blank OR seeded line
// (mirror addTaakMateriaal / addTaakRegel). All fields optional → blank row.
export const addMateriaalSchema = z
  .object({
    name: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().optional(),
    diameter: z.number().optional(),
    label: z.string().optional(),
  })
  .optional();

// PATCH /work-orders/:id/materials/:matId — mirror updateTaakMateriaal patch.
export const updateMateriaalSchema = z.object({
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
});

// POST /work-orders/:id/materials/:matId/usage — mirror setMateriaalUsage.
export const usageSchema = z.object({
  used: z.number(),
});

// POST /work-orders/:id/finish — mirror afrondenWerkbon (signature required).
export const finishSchema = z.object({
  signature: z.string().min(1),
});
