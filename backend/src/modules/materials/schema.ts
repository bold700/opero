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
