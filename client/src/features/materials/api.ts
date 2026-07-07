import { api, type Page } from "../../lib/api/client";

export type StockStatus = "ok" | "low" | "out_of_stock";

// Mirrors the backend materialListDto (backend/src/modules/materials/dto.ts).
export type MaterialRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  supplier: string;
  status: StockStatus;
  // Unit price — present only for admins (stripped server-side for technicians).
  unitPrice?: number;
};

// One combined input from the dialog (material + inventory fields).
export type MaterialInput = {
  name: string;
  unit: string;
  category?: string;
  unitPrice?: number;
  stock?: number;
  minStock?: number;
  supplier?: string;
};

// Per-status totals across the whole (searched) set — powers the KPI cards.
// Always present even when a status filter is active.
export type MaterialCounts = { total: number; ok: number; low: number; out_of_stock: number };

// One page of the materials list plus the counts.
export type MaterialPage = Page<MaterialRow> & { counts: MaterialCounts };

// Fetch one page. `filter` filters server-side (undefined = all); `search`
// searches name/category/supplier server-side; `cursor` continues the list.
export function getMaterialsPage(opts: {
  cursor?: string;
  search?: string;
  filter?: "ok" | "low" | "out_of_stock";
}): Promise<MaterialPage> {
  return api.getPage<MaterialRow>("/materials", {
    cursor: opts.cursor,
    search: opts.search,
    params: { filter: opts.filter },
  }) as Promise<MaterialPage>;
}

// A managed material category (the org's own list). `count` = materials using it.
export type Category = { id: string; name: string; count: number };

// The managed category list (the dropdown source).
export function getCategories(): Promise<Category[]> {
  return api.get<Category[]>("/materials/categories");
}

// Create a new category (admin). Returns it; 409 if the name already exists.
export function createCategory(name: string): Promise<Category> {
  return api.post<Category>("/materials/categories", { name });
}

// Rename a category (admin). Cascades to materials using the old name.
export function renameCategory(id: string, name: string): Promise<Category> {
  return api.patch<Category>(`/materials/categories/${id}`, { name });
}

// Delete a category (admin). 409 if any material still uses it.
export function deleteCategory(id: string): Promise<void> {
  return api.delete<void>(`/materials/categories/${id}`);
}

// Create takes everything in one call (seeds the inventory row).
export function createMaterial(input: MaterialInput): Promise<MaterialRow> {
  return api.post<MaterialRow>("/materials", {
    name: input.name,
    unit: input.unit,
    category: input.category,
    unitPrice: input.unitPrice,
    quantityInStock: input.stock,
    reorderPoint: input.minStock,
    supplier: input.supplier,
  });
}

// Material fields only.
export function updateMaterial(
  id: string,
  fields: { name?: string; unit?: string; category?: string; unitPrice?: number },
): Promise<MaterialRow> {
  return api.patch<MaterialRow>(`/materials/${id}`, fields);
}

// Inventory fields (separate endpoint; creates the row if absent).
export function updateInventory(
  id: string,
  fields: { quantityInStock?: number; reorderPoint?: number; supplier?: string; unit?: string },
): Promise<unknown> {
  return api.patch(`/materials/${id}/inventory`, fields);
}

export function deleteMaterial(id: string): Promise<void> {
  return api.delete<void>(`/materials/${id}`);
}
