import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../components/StatusBadge";
import { STATUS_TONES } from "../../../theme/tokens";
import type { CustomerType } from "../api";

// Customer type badge: lavender for business, neutral for private.
export function TypeBadge({ type }: { type: CustomerType }) {
  const { t } = useTranslation();
  const tone = type === "business" ? STATUS_TONES.open : STATUS_TONES.neutral;
  return <StatusBadge label={t(`customers.typeBadge.${type}`)} tone={tone} />;
}
