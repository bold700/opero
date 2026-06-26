import type {
  Article,
  Inventory,
  Material,
  MaterialOrder,
  MaterialOrderItem,
} from "@prisma/client";

// DTO mappers — never return raw rows with internal columns to clients.

export function inventoryDto(i: Inventory) {
  return {
    id: i.id,
    materialId: i.materialId,
    materialName: i.materialName,
    quantityInStock: i.quantityInStock,
    unit: i.unit,
    supplier: i.supplier,
    reorderPoint: i.reorderPoint,
  };
}

export function materialDto(m: Material & { inventory?: Inventory | null }) {
  return {
    id: m.id,
    name: m.name,
    unit: m.unit,
    category: m.category,
    inventory: m.inventory ? inventoryDto(m.inventory) : undefined,
  };
}

// Stock status derived from quantity vs reorder point (per the design's column).
export type MaterialStockStatus = "ok" | "low" | "out_of_stock";

function deriveStockStatus(inv: Inventory | null | undefined): MaterialStockStatus {
  if (!inv) return "out_of_stock";
  if (inv.quantityInStock <= 0) return "out_of_stock";
  if (inv.quantityInStock < inv.reorderPoint) return "low";
  return "ok";
}

// Flat row for the materials list (per the Figma): name, category, unit, stock,
// min stock, derived status.
export function materialListDto(m: Material & { inventory?: Inventory | null }) {
  const inv = m.inventory ?? null;
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    unit: m.unit,
    stock: inv?.quantityInStock ?? 0,
    minStock: inv?.reorderPoint ?? 0,
    supplier: inv?.supplier ?? "—",
    status: deriveStockStatus(inv),
  };
}

export function articleDto(a: Article) {
  return {
    id: a.id,
    category: a.category,
    name: a.name,
    unit: a.unit,
    unitPrice: a.unitPrice,
    defaultQuantity: a.defaultQuantity,
  };
}

export function workTypeDto(w: { id: string; name: string }) {
  return {
    id: w.id,
    name: w.name,
  };
}

export function materialOrderItemDto(i: MaterialOrderItem) {
  return {
    id: i.id,
    orderId: i.orderId,
    materialName: i.materialName,
    quantityToOrder: i.quantityToOrder,
    unit: i.unit,
    supplier: i.supplier,
  };
}

export function materialOrderDto(
  o: MaterialOrder & { items?: MaterialOrderItem[] },
) {
  return {
    id: o.id,
    projectId: o.projectId ?? undefined,
    createdAt: o.createdAt,
    receivedAt: o.receivedAt ?? undefined,
    items: (o.items ?? []).map(materialOrderItemDto),
  };
}
