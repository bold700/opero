import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { WorkOrderStatus } from "./api";

// English status value → i18n label key + tone. Translate at the call site;
// never call t() at module level.
export const STATUS: Record<WorkOrderStatus, { labelKey: string; tone: StatusTone }> = {
  open: { labelKey: "workOrders.status.open", tone: STATUS_TONES.open },
  on_the_way: { labelKey: "workOrders.status.onTheWay", tone: STATUS_TONES.info },
  urgent: { labelKey: "workOrders.status.urgent", tone: STATUS_TONES.danger },
  done: { labelKey: "workOrders.status.done", tone: STATUS_TONES.success },
};

// Stable filter keys (English) → status value (null = "all"). The label is
// translated at the call site via `workOrders.filters.<key>`.
export const FILTERS = [
  { key: "all", status: null as WorkOrderStatus | null },
  { key: "open", status: "open" as WorkOrderStatus | null },
  { key: "onTheWay", status: "on_the_way" as WorkOrderStatus | null },
  { key: "urgent", status: "urgent" as WorkOrderStatus | null },
  { key: "done", status: "done" as WorkOrderStatus | null },
] as const;

// "2025-06-18T..." → "18 jun"; falls back to "—".
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
