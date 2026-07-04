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
};

// One combined input from the dialog (material + inventory fields).
export type MaterialInput = {
  name: string;
  unit: string;
  category?: string;
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

// The managed category list (the dropdown source).
export function getCategories(): Promise<string[]> {
  return api.get<string[]>("/materials/categories");
}

// Create takes everything in one call (seeds the inventory row).
export function createMaterial(input: MaterialInput): Promise<MaterialRow> {
  return api.post<MaterialRow>("/materials", {
    name: input.name,
    unit: input.unit,
    category: input.category,
    quantityInStock: input.stock,
    reorderPoint: input.minStock,
    supplier: input.supplier,
  });
}

// Material fields only.
export function updateMaterial(
  id: string,
  fields: { name?: string; unit?: string; category?: string },
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
