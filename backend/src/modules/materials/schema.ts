import { z } from "zod";

// Local request schemas for the materials module. Kept module-local (not in
// @opero/shared) per task scope. The materials CATALOG itself is read-only
// (seeded from @opero/shared) — no create/update schemas for it.

// --- Articles (catalog) ---------------------------------------------------

export const catalogCategorySchema = z.enum([
  "insulation",
  "material",
  "labor",
  "logistics",
]);

export const createArticleSchema = z.object({
  category: catalogCategorySchema,
  name: z.string().min(1),
  unit: z.string().min(1),
  unitPrice: z.number(),
  defaultQuantity: z.number().default(0),
});
export type CreateArticleRequest = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = createArticleSchema.partial();
export type UpdateArticleRequest = z.infer<typeof updateArticleSchema>;

// --- Work types -----------------------------------------------------------

export const createWorkTypeSchema = z.object({
  name: z.string().min(1),
});
export type CreateWorkTypeRequest = z.infer<typeof createWorkTypeSchema>;

export const renameWorkTypeSchema = z.object({
  name: z.string().min(1),
});
export type RenameWorkTypeRequest = z.infer<typeof renameWorkTypeSchema>;

// --- Material orders (purchase list) --------------------------------------

export const materialOrderItemSchema = z.object({
  materialName: z.string().min(1),
  quantityToOrder: z.number(),
  unit: z.string().min(1),
  supplier: z.string().default(""),
});

export const createMaterialOrderSchema = z.object({
  projectId: z.string().optional(),
  items: z.array(materialOrderItemSchema),
});
export type CreateMaterialOrderRequest = z.infer<typeof createMaterialOrderSchema>;

// --- Materials catalog CRUD -----------------------------------------------
// The catalog is normal user-managed data: the seed only bootstraps it, and
// admins create/edit/delete materials + variants from here on. `key` is NOT a
// user field — it's auto-generated server-side. Provenance fields are optional
// metadata (they mattered only for seed data imported from supplier PDFs).

export const materialClassSchema = z.enum([
  "insulation",
  "fitting",
  "tank",
  "cladding",
]);

// Installation-system groups (GKW / CV / KW-WW-CIRC / RIOOL-HWA) — a different
// axis from `class`. Mirrors the Prisma MaterialSystemCategory enum.
export const materialSystemCategorySchema = z.enum([
  "gkw",
  "cv",
  "kw_ww_circ",
  "riool_hwa",
]);

// ?category= on the list/search routes. "" (or an absent param) means "all",
// so an uncategorised material is never hidden by default.
export const materialCategoryFilterSchema = materialSystemCategorySchema
  .or(z.literal(""))
  .optional();

export const materialComponentSchema = z.enum([
  "meter",
  "elbow",
  "coupling",
  "tee",
  "threaded_fitting",
  "flange",
  "valve",
  "pump",
  "air_separator",
  "reducer",
  "alu_cap",
  "buffer_vessel",
  "area",
]);

export const sizeUnitSchema = z.enum([
  "pipe_od_mm",
  "pipe_dia_mm",
  "tank_liters",
  "flat",
]);

export const variantUnitSchema = z.enum(["m", "piece", "m2"]);

export const createMaterialSchema = z.object({
  name: z.string().min(1),
  class: materialClassSchema,
  // Nullable: a material that spans systems (or isn't sorted yet) has none.
  category: materialSystemCategorySchema.nullable().optional(),
  supplier: z.string().default(""),
  sizeUnit: sizeUnitSchema,
  thicknessMm: z.number().int().nonnegative().nullable().optional(),
  pipeMaterial: z.string().nullable().optional(),
  finish: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  // Optional provenance metadata (blank for hand-created materials).
  priceSource: z.string().nullable().optional(),
  priceValidFrom: z.string().nullable().optional(), // ISO date
  priceValidTo: z.string().nullable().optional(),
  priceNote: z.string().nullable().optional(),
});
export type CreateMaterialRequest = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = createMaterialSchema.partial();
export type UpdateMaterialRequest = z.infer<typeof updateMaterialSchema>;

export const createVariantSchema = z.object({
  size: z.string().min(1),
  component: materialComponentSchema,
  thicknessMm: z.number().int().nonnegative().nullable().optional(),
  unit: variantUnitSchema,
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).nullable().optional(),
});
export type CreateVariantRequest = z.infer<typeof createVariantSchema>;

// PATCH /variants/:id — full variant edit. `costPrice: null` clears it. A
// cost-only edit (the earlier behaviour) is just this with one field.
export const updateVariantSchema = createVariantSchema.partial().extend({
  costPrice: z.number().min(0).nullable().optional(),
});
export type UpdateVariantRequest = z.infer<typeof updateVariantSchema>;
