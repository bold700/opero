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

export function materialDto(m: Material & { inventory?: Inventory | null; unitPrice?: number }) {
  return {
    id: m.id,
    name: m.name,
    unit: m.unit,
    category: m.category,
    unitPrice: m.unitPrice ?? 0,
    inventory: m.inventory ? inventoryDto(m.inventory) : undefined,
  };
}

// Stock status is derived from quantity vs reorder point but PERSISTED on
// Material.stockStatus (kept in sync by recomputeMaterialStock) so the list can
// filter/count on a real column. The derivation itself lives in ./status.ts.
export type { MaterialStockStatus } from "./status.js";

// Flat row for the materials list (per the Figma): name, category, unit, stock,
// min stock, status. `status` reads the denormalized column. `unitPrice` is
// stripped for technicians (showPrices=false), mirroring articleDto.
export function materialListDto(
  m: Material & { inventory?: Inventory | null; stockStatus?: string; unitPrice?: number },
  showPrices = true,
) {
  const inv = m.inventory ?? null;
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    unit: m.unit,
    stock: inv?.quantityInStock ?? 0,
    minStock: inv?.reorderPoint ?? 0,
    supplier: inv?.supplier ?? "—",
    status: (m.stockStatus ?? "out_of_stock") as
      | "ok"
      | "low"
      | "out_of_stock",
    ...(showPrices ? { unitPrice: m.unitPrice ?? 0 } : {}),
  };
}

// The article catalog carries a unitPrice (it's the price list). Strip it for
// technicians when the org hides prices from them; admins always see it.
export function articleDto(a: Article, showPrices = true) {
  return {
    id: a.id,
    category: a.category,
    name: a.name,
    unit: a.unit,
    ...(showPrices ? { unitPrice: a.unitPrice } : {}),
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
