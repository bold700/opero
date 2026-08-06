import type {
  Article,
  Material,
  MaterialOrder,
  MaterialOrderItem,
  MaterialVariant,
} from "@prisma/client";
import { buildMaterialLineName } from "./labels.js";

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

// Variant price is stripped for field staff (canSeePrices — absolute, there is
// no org toggle; same conditional-spread pattern as articleDto). `costPrice` is
// admin-only (showMargin) — clients get the selling price but never the cost.
export function variantDto(v: MaterialVariant, showPrices = true, showMargin = false) {
  return {
    id: v.id,
    size: v.size,
    component: v.component,
    thicknessMm: v.thicknessMm ?? undefined,
    // Raw enum unit ("m" | "piece" | "m2") — English internal. The client
    // translates it to a display word at render time via i18n.
    unit: v.unit,
    ...(showPrices ? { unitPrice: v.unitPrice } : {}),
    ...(showMargin ? { costPrice: v.costPrice ?? undefined } : {}),
  };
}

// Material detail: attributes + the full variant set. Price provenance
// (priceSource/validFrom/validTo/priceNote) is optional metadata surfaced ONLY
// to admins (showMargin) so the edit form can prefill it; other roles don't see
// it.
export function materialDetailDto(
  m: Material & { variants: MaterialVariant[] },
  showPrices = true,
  showMargin = false,
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
    variants: m.variants.map((v) => variantDto(v, showPrices, showMargin)),
    // Provenance (admin-only) — where the prices came from + validity window.
    ...(showMargin
      ? {
          priceSource: m.priceSource ?? undefined,
          priceValidFrom: m.priceValidFrom ? m.priceValidFrom.toISOString().slice(0, 10) : undefined,
          priceValidTo: m.priceValidTo ? m.priceValidTo.toISOString().slice(0, 10) : undefined,
          priceNote: m.priceNote ?? undefined,
        }
      : {}),
  };
}

// A single flat search row = one variant, with a composed Dutch description
// (same naming as the work-order line), its material context and price.
export function variantSearchRowDto(
  v: MaterialVariant & { material: Material },
  showPrices = true,
  showMargin = false,
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
    // Raw enum unit — English internal; the client translates at render time.
    unit: v.unit,
    ...(showPrices ? { unitPrice: v.unitPrice } : {}),
    ...(showMargin ? { costPrice: v.costPrice ?? undefined } : {}),
  };
}

// The article catalog carries a unitPrice (it's the price list). Strip it for
// field staff (canSeePrices — absolute, no org toggle); admins always see it.
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
