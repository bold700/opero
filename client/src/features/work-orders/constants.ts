import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { WorkOrderPhase } from "@opero/shared";
import type { WorkOrderStatus } from "./api";

export const WORK_ORDER_PHASE_TONES: Record<WorkOrderPhase, StatusTone> = {
  preparation: STATUS_TONES.open,
  realization: STATUS_TONES.info,
  completion: STATUS_TONES.success,
};

// English status value → i18n label key + tone. Translate at the call site;
// never call t() at module level.
export const STATUS: Record<WorkOrderStatus, { labelKey: string; tone: StatusTone }> = {
  open: { labelKey: "workOrders.status.open", tone: STATUS_TONES.open },
  planned: { labelKey: "workOrders.status.planned", tone: STATUS_TONES.info },
  released: { labelKey: "workOrders.status.released", tone: STATUS_TONES.info },
  in_progress: { labelKey: "workOrders.status.inProgress", tone: STATUS_TONES.info },
  ready_for_review: { labelKey: "workOrders.status.readyForReview", tone: STATUS_TONES.warning },
  approved: { labelKey: "workOrders.status.approved", tone: STATUS_TONES.success },
  ready_to_invoice: { labelKey: "workOrders.status.readyToInvoice", tone: STATUS_TONES.success },
  invoiced: { labelKey: "workOrders.status.invoiced", tone: STATUS_TONES.info },
  completed: { labelKey: "workOrders.status.completed", tone: STATUS_TONES.success },
};

// Stable filter keys (English) → status value (null = "all"). The label is
// translated at the call site via `workOrders.filters.<key>`.
export const FILTERS = [
  { key: "all", status: null as WorkOrderStatus | null },
  { key: "open", status: "open" as WorkOrderStatus | null },
  { key: "planned", status: "planned" as WorkOrderStatus | null },
  { key: "released", status: "released" as WorkOrderStatus | null },
  { key: "inProgress", status: "in_progress" as WorkOrderStatus | null },
  { key: "readyForReview", status: "ready_for_review" as WorkOrderStatus | null },
  { key: "approved", status: "approved" as WorkOrderStatus | null },
  { key: "readyToInvoice", status: "ready_to_invoice" as WorkOrderStatus | null },
  { key: "invoiced", status: "invoiced" as WorkOrderStatus | null },
  { key: "completed", status: "completed" as WorkOrderStatus | null },
] as const;
