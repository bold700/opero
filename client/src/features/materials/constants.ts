import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { StockStatus } from "./api";

// English status value → i18n label key + tone. Translate labelKey at call sites.
export const STATUS: Record<StockStatus, { labelKey: string; tone: StatusTone }> = {
  ok: { labelKey: "materials.status.ok", tone: STATUS_TONES.success },
  low: { labelKey: "materials.status.low", tone: STATUS_TONES.danger },
  out_of_stock: { labelKey: "materials.status.outOfStock", tone: STATUS_TONES.danger },
};

// Stable English filter keys; translate labels at call sites.
export type MaterialFilter = "all" | "ok" | "low" | "out_of_stock";
export const FILTERS: MaterialFilter[] = ["all", "ok", "low", "out_of_stock"];

// i18n label key for a filter chip.
export const FILTER_LABEL_KEYS: Record<MaterialFilter, string> = {
  all: "materials.filters.all",
  ok: "materials.filters.ok",
  low: "materials.filters.low",
  out_of_stock: "materials.filters.outOfStock",
};

// Deterministic swatch color from the material name.
const COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#9333EA", "#14B8A6", "#EAB308", "#6B7280"];
export function swatchColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}
