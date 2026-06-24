import { StatusBadge } from "../../../components/StatusBadge";
import { STATUS_TONES } from "../../../theme/tokens";
import type { CustomerType } from "../api";
import { TYPE_LABEL } from "../constants";

// Customer type badge: lavender for business, neutral for private.
export function TypeBadge({ type }: { type: CustomerType }) {
  const tone = type === "business" ? STATUS_TONES.open : STATUS_TONES.neutral;
  return <StatusBadge label={TYPE_LABEL[type]} tone={tone} />;
}
