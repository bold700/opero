import { api, type Page } from "../../lib/api/client";

export type WorkOrderStatus = "open" | "on_the_way" | "urgent" | "done";

// Mirrors the backend workOrderListDto (backend/src/modules/work-orders/dto.ts).
export type WorkOrderRow = {
  id: string;
  number: string;
  customerName: string;
  city: string;
  workType: string;
  technician: string;
  status: WorkOrderStatus;
  date: string;
};

// Per-status totals across the whole (scoped+searched) set — powers the count
// pills. Always present even when a status filter is active.
export type WorkOrderCounts = {
  total: number;
  open: number;
  on_the_way: number;
  urgent: number;
  done: number;
};

// One page of the work-orders list plus the counts.
export type WorkOrderPage = Page<WorkOrderRow> & { counts: WorkOrderCounts };

// Fetch one page. `status` filters server-side (undefined = all); `search`
// searches number/customer/city server-side; `cursor` continues the list.
export function getWorkOrdersPage(opts: {
  cursor?: string;
  search?: string;
  status?: WorkOrderStatus;
}): Promise<WorkOrderPage> {
  return api.getPage<WorkOrderRow>("/work-orders", {
    cursor: opts.cursor,
    search: opts.search,
    params: { status: opts.status },
  }) as Promise<WorkOrderPage>;
}
