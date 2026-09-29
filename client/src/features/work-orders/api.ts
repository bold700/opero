import { api, type Page } from "../../lib/api/client";
import type { WorkOrderPhase, WorkOrderStatus } from "@opero/shared";

export type { WorkOrderPhase, WorkOrderStatus };

// Mirrors the backend workOrderListDto (backend/src/modules/work-orders/dto.ts).
export type WorkOrderRow = {
  id: string;
  number: string;
  title: string;
  customerName: string;
  city: string;
  workType: string;
  technician: string;
  status: WorkOrderStatus;
  phase: WorkOrderPhase;
  createdAt: string;
  // Release state — undefined until the office dispatches. A separate axis
  // from `status`: progress and release are independent.
  dispatchedAt?: string;
  // Planned work date — null until the werkbon is scheduled.
  date: string | null;
};

// Per-status totals across the whole (scoped+searched) set — powers the count
// pills. Always present even when a status filter is active.
export type WorkOrderCounts = Record<WorkOrderStatus, number> & { total: number };

// One page of the work-orders list plus the counts.
export type WorkOrderPage = Page<WorkOrderRow> & { counts: WorkOrderCounts };

// The narrowing filters the overview offers, beyond the status chips. All
// optional and ANDed server-side. Dates are plain "YYYY-MM-DD" days matched
// against the werkbon's plannedDate (inclusive both ends).
export type WorkOrderFilters = {
  customerId?: string;
  assigneeId?: string;
  // "Type werk": a material on the werkbon's lines (what the column shows).
  materialId?: string;
  dateFrom?: string;
  dateTo?: string;
};

// Fetch one page. `status` filters server-side (undefined = all); `search`
// searches number/customer/city server-side; `cursor` continues the list.
export function getWorkOrdersPage(
  opts: {
    cursor?: string;
    search?: string;
    status?: WorkOrderStatus;
  } & WorkOrderFilters,
): Promise<WorkOrderPage> {
  return api.getPage<WorkOrderRow>("/work-orders", {
    cursor: opts.cursor,
    search: opts.search,
    params: {
      status: opts.status,
      customerId: opts.customerId,
      assigneeId: opts.assigneeId,
      materialId: opts.materialId,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
    },
  }) as Promise<WorkOrderPage>;
}

// Options for the filter dropdowns. Small reference lists, fetched once when
// the filter bar opens rather than bundled into every list response.
export type FilterOption = { id: string; name: string };

export function getWorkOrderFilterOptions(): Promise<{
  customers: FilterOption[];
  assignees: FilterOption[];
  materials: FilterOption[];
}> {
  return api.get("/work-orders/filter-options");
}
