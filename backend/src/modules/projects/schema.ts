import { z } from "zod";

// Local zod schemas for the projects module (not shared). Mirror the store's
// CreateProjectInput / update patches / nested actions. All text is clamped in
// the handlers (clampText/clampNumber), so these keep validation light.

const projectStatusSchema = z.enum(["sales", "operations", "closing"]);
const stageSchema = z.enum(["concept", "in_progress", "ready", "done"]);
const urgencySchema = z.enum(["normal", "urgent", "blocked"]);

// DELETE photo routes carry the object key to remove in the body.
export const removePhotoSchema = z.object({ photo: z.string().min(1) });

// POST / — create. Mirror CreateProjectInput (customerId required; the rest are
// optional seeds copied from the customer / used as defaults).
export const createProjectSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().optional(),
  // Work type is chosen from the managed WorkType list (preferred). Free-text
  // insulationType is still accepted for back-compat but workTypeId wins.
  workTypeId: z.string().optional(),
  insulationType: z.string().optional(),
  locationId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// PATCH /:id — header fields (mirror updateProject's patch shape).
export const updateProjectSchema = z.object({
  name: z.string().optional(),
  // Reassign the project to a different customer. This is an ACCESS change: the
  // client portal is scoped by project.customerId, so the old customer's login
  // loses this job and the new one gains it. Admin-only (the route gate).
  customerId: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  instructions: z.string().optional(),
  insulationType: z.string().optional(),
  materialsReady: z.boolean().optional(),
  exclusions: z.string().optional(),
  billingType: z.enum(["fixed", "time_and_materials"]).nullable().optional(),
  // Sidebar fields surfaced from the werkbon detail (all project-level).
  urgency: z.enum(["normal", "urgent", "blocked"]).optional(),
  projectLeaderId: z.string().nullable().optional(),
  installerIds: z.array(z.string()).optional(),
  workTypeId: z.string().nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const statusSchema = z.object({ status: projectStatusSchema });

export const stageSchema_ = z
  .object({
    stage: stageSchema.optional(),
    advance: z.boolean().optional(),
  })
  .refine((v) => v.advance === true || v.stage !== undefined, {
    message: "Provide a stage or advance:true",
  });

export const urgencyBodySchema = z.object({ urgency: urgencySchema });

export const resolveBlockerSchema = z.object({ note: z.string().optional() });

export const teamSchema = z.object({
  projectLeaderId: z.string().nullable().optional(),
  teamLeaderId: z.string().nullable().optional(),
  installerIds: z.array(z.string()).optional(),
});

export const commentSchema = z.object({ body: z.string().min(1) });

// Intake update (PATCH /:id/intake) — partial intake fields.
export const updateIntakeSchema = z.object({
  plannedDate: z.string().nullable().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  insulationType: z.string().optional(),
  squareMeters: z.number().optional(),
  cavityWidthMm: z.number().nullable().optional(),
  existingInsulation: z.boolean().nullable().optional(),
  buildingType: z.string().nullable().optional(),
  accessibility: z.string().nullable().optional(),
  notes: z.string().optional(),
  risks: z.string().optional(),
  estimatedLaborHours: z.number().optional(),
});

// Intake complete (POST /:id/intake/complete) — mirror completeIntake's data.
export const completeIntakeSchema = z.object({
  insulationType: z.string().optional(),
  squareMeters: z.number().optional(),
  cavityWidthMm: z.number().optional(),
  existingInsulation: z.boolean().optional(),
  buildingType: z.string().optional(),
  accessibility: z.string().optional(),
  estimatedLaborHours: z.number().optional(),
  notes: z.string().optional(),
  risks: z.string().optional(),
  blocker: z.string().optional(),
});

// Quote line items.
export const addQuoteLineSchema = z
  .object({
    description: z.string().optional(),
    workType: z.string().optional(),
    size: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().optional(),
  })
  .optional();

export const updateQuoteLineSchema = z.object({
  description: z.string().optional(),
  workType: z.string().optional(),
  size: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
});

export const quoteFromCatalogSchema = z.object({
  catalogItemId: z.string().min(1),
  quantity: z.number().optional(),
});

// ExtraWork (mirror addExtraWork input). Free-text meerwerk: name/qty/unit are
// the reporter's own words. A client-supplied `unitPrice` is only honored for
// admins — a technician's price is discarded server-side (see the route).
export const addExtraWorkSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  diameter: z.number().optional(),
  unitPrice: z.number().optional(),
  label: z.string().optional(),
  photo: z.boolean().optional(),
});

// ExtraWork picked from the materials catalog. Only the variant + quantity are
// sent; name/unit/price/cost/diameter resolve SERVER-side from the variant, so
// a technician can never inject a price.
export const addExtraWorkFromCatalogSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().positive().optional(),
});

// Edit an existing meerwerk row. `variantId` re-points it at a catalog variant
// (name/unit/price/cost/diameter re-resolve SERVER-side); the free-text fields
// edit an uncatalogued row. A client-supplied `unitPrice` is only honored for
// admins on a free-text row (see the route) — same rule as create.
export const updateExtraWorkSchema = z.object({
  variantId: z.string().nullable().optional(),
  name: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  diameter: z.number().nullable().optional(),
  unitPrice: z.number().optional(),
  label: z.string().nullable().optional(),
});

export const rejectExtraWorkSchema = z.object({
  by: z.enum(["office", "client"]).optional(),
});

// Handover.
export const restpuntenSchema = z.object({ restpunten: z.string() });
export const signHandoverSchema = z.object({ signedBy: z.string().min(1) });
