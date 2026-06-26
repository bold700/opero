import { STATUS_TONES, type StatusTone } from "../../theme/tokens";

// Translation key suffixes for project stage shown in the detail header.
// Resolved to display text at call sites via t("workOrderDetail.stage.<key>").
export const STAGE_LABEL_KEY: Record<string, string> = {
  sales: "sales",
  operations: "operations",
  closing: "closing",
  done: "done",
};

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
  rejected: boolean;
  approvedByOffice: boolean;
  approvedByClient: boolean;
}): { key: string; tone: StatusTone } {
  if (m.rejected) return { key: "rejected", tone: STATUS_TONES.danger };
  if (m.approvedByOffice && m.approvedByClient)
    return { key: "approved", tone: STATUS_TONES.success };
  if (m.approvedByOffice)
    return { key: "waitingClient", tone: STATUS_TONES.info };
  return { key: "waitingOffice", tone: STATUS_TONES.warning };
}

// Resolve an activity row to display text. Comments carry the user's own words
// in `body`; system/status/scheduled events carry a messageKey + params that we
// translate via i18n. Internals are English; only the rendered text is localized.
type TFunc = (key: string, options?: Record<string, unknown>) => string;

export function activityText(
  t: TFunc,
  a: {
    type: string;
    messageKey?: string;
    params?: Record<string, unknown>;
    body?: string;
  },
): string {
  if (a.type === "comment") return a.body ?? "";
  if (!a.messageKey) return a.body ?? "";

  const params = { ...(a.params ?? {}) };

  // Compose the over/under-plan suffix for usage changes (kept as a separate
  // keyed fragment so each language phrases it naturally).
  if (a.messageKey === "material.usageChanged") {
    const kind = params.deltaKind;
    params.suffix =
      kind === "over"
        ? t("activity.material.usageOver", params)
        : kind === "under"
          ? t("activity.material.usageUnder", params)
          : "";
  }

  return t(`activity.${a.messageKey}`, params);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function euro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
