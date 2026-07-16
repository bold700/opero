import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { ProjectStatus, ProjectStage } from "./api";

// Project lifecycle status → badge tone. Sales (starting) → open (lavender),
// operations (in progress) → info, closing (wrapping up) → success.
export const PROJECT_STATUS_TONES: Record<ProjectStatus, StatusTone> = {
  sales: STATUS_TONES.open,
  operations: STATUS_TONES.info,
  closing: STATUS_TONES.success,
};

// Stage → tone (concept → neutral … done → success).
export const PROJECT_STAGE_TONES: Record<ProjectStage, StatusTone> = {
  concept: STATUS_TONES.neutral,
  in_progress: STATUS_TONES.info,
  ready: STATUS_TONES.open,
  done: STATUS_TONES.success,
};

// EUR (excl. VAT) — whole-euro amounts (project/werkbon value is an integer).
export function euro(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
