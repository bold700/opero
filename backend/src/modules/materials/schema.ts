import { z } from "zod";

// Local request schemas for the materials module. Kept module-local (not in
// @opero/shared) per task scope.

// --- Materials + inventory ------------------------------------------------

// On create, the optional inventory fields seed the linked Inventory row.
export const createMaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  quantityInStock: z.number().optional(),
  supplier: z.string().optional(),
  reorderPoint: z.number().optional(),
});
export type CreateMaterialRequest = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = z
  .object({
    name: z.string().min(1),
    unit: z.string().min(1),
  })
  .partial();
export type UpdateMaterialRequest = z.infer<typeof updateMaterialSchema>;

export const updateInventorySchema = z.object({
  quantityInStock: z.number().optional(),
  supplier: z.string().optional(),
  reorderPoint: z.number().optional(),
  unit: z.string().optional(),
});
export type UpdateInventoryRequest = z.infer<typeof updateInventorySchema>;

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
