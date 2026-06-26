import { api } from "../../lib/api/client";

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

export function getWorkOrders(): Promise<WorkOrderRow[]> {
  return api.get<WorkOrderRow[]>("/work-orders");
}
