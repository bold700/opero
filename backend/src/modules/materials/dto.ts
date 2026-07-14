import type {
  Article,
  Material,
  MaterialOrder,
  MaterialOrderItem,
  MaterialVariant,
} from "@prisma/client";
import { buildMaterialLineName, LINE_UNIT_LABELS } from "./labels.js";

// DTO mappers — never return raw rows with internal columns to clients.

// Numeric min–max of a material's variant sizes ("Ø 17–324" / "150–2500 L"),
// null when sizes aren't numeric (combined sizes like "21/22" are skipped;
// "flat" materials have no range).
function sizeRange(variants: Pick<MaterialVariant, "size">[]): { min: number; max: number } | null {
  const nums = variants
    .map((v) => Number(v.size))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

// Summary row for the class-grouped catalog list (no variants payload).
export function materialSummaryDto(
  m: Material & { variants: Pick<MaterialVariant, "size">[] },
) {
  return {
    id: m.id,
    key: m.key,
    name: m.name,
    class: m.class,
    supplier: m.supplier,
    thicknessMm: m.thicknessMm ?? undefined,
    pipeMaterial: m.pipeMaterial ?? undefined,
    finish: m.finish ?? undefined,
    sizeUnit: m.sizeUnit,
    note: m.note ?? undefined,
    variantCount: m.variants.length,
    sizeRange: sizeRange(m.variants) ?? undefined,
  };
}

// Variant price is stripped for technicians when the org hides prices from
// them (same conditional-spread pattern as articleDto).
export function variantDto(v: MaterialVariant, showPrices = true) {
  return {
    id: v.id,
    size: v.size,
    component: v.component,
    thicknessMm: v.thicknessMm ?? undefined,
    unit: v.unit,
    ...(showPrices ? { unitPrice: v.unitPrice } : {}),
  };
}

// Material detail: attributes + price provenance + the full variant set.
export function materialDetailDto(
  m: Material & { variants: MaterialVariant[] },
  showPrices = true,
) {
  return {
    id: m.id,
    key: m.key,
    name: m.name,
    class: m.class,
    supplier: m.supplier,
    thicknessMm: m.thicknessMm ?? undefined,
    pipeMaterial: m.pipeMaterial ?? undefined,
    finish: m.finish ?? undefined,
    sizeUnit: m.sizeUnit,
    note: m.note ?? undefined,
    priceSource: m.priceSource ?? undefined,
    priceValidFrom: m.priceValidFrom?.toISOString() ?? undefined,
    priceValidTo: m.priceValidTo?.toISOString() ?? undefined,
    priceNote: m.priceNote ?? undefined,
    variantCount: m.variants.length,
    variants: m.variants.map((v) => variantDto(v, showPrices)),
  };
}

// A single flat search row = one variant, with a composed Dutch description
// (same naming as the work-order line), its material context and price.
export function variantSearchRowDto(
  v: MaterialVariant & { material: Material },
  showPrices = true,
) {
  return {
    id: v.id, // = variantId
    materialId: v.materialId,
    name: buildMaterialLineName(v.material, v, "nl"),
    materialName: v.material.name,
    class: v.material.class,
    supplier: v.material.supplier,
    size: v.size,
    sizeUnit: v.material.sizeUnit,
    component: v.component,
    thicknessMm: v.thicknessMm ?? undefined,
    unit: LINE_UNIT_LABELS[v.unit]?.nl ?? v.unit,
    ...(showPrices ? { unitPrice: v.unitPrice } : {}),
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
