import { STATUS_TONES, type StatusTone } from "../../theme/tokens";

// Translation key suffixes for project stage shown in the detail header.

// Urgency → translation key suffix + badge tone. Translate at call sites via
// t("workOrderDetail.urgency.<key>").
export const URGENCY: Record<string, { key: string; tone: StatusTone }> = {
  normal: { key: "normal", tone: STATUS_TONES.neutral },
  urgent: { key: "urgent", tone: STATUS_TONES.danger },
  blocked: { key: "blocked", tone: STATUS_TONES.warning },
};

// Extra-work approval state → badge. Returns a translation key suffix (resolve
// via t("workOrderDetail.extraWorkStatus.<key>")) plus the badge tone.
export function extraWorkBadge(m: {
  rejected?: boolean;
  approvedByOffice?: boolean;
  approvedByClient?: boolean;
}): { key: string; tone: StatusTone } {
  if (m.rejected) return { key: "rejected", tone: STATUS_TONES.danger };
  if (m.approvedByOffice && m.approvedByClient)
    return { key: "approved", tone: STATUS_TONES.success };
  if (m.approvedByOffice)
    return { key: "waitingClient", tone: STATUS_TONES.info };
  return { key: "waitingOffice", tone: STATUS_TONES.warning };
}

export function euro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
