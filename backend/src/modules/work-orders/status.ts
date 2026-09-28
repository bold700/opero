import type { Prisma, PrismaClient } from "@prisma/client";
import {
  deriveWorkOrderStatus,
  type WorkOrderStatus,
} from "@opero/shared";
import { prisma } from "../../db/client.js";

// Denormalized work-order lifecycle. The value is derived from planning,
// release, execution, approval and billing records, then persisted so list
// filtering and pagination can use one indexed column.

export type WorkOrderListStatus = WorkOrderStatus;

// A Prisma client or an interactive transaction client.
type Db = PrismaClient | Prisma.TransactionClient;

// Pure derivation is shared by the client and backend.
export { deriveWorkOrderStatus } from "@opero/shared";

// Recompute + persist listStatus for ONE work order. Returns the value written.
// No-op write is fine (Prisma still issues it); callers invoke this after any
// task toggle/start/end or completion inside their transaction.
export async function recomputeWorkOrderStatus(
  db: Db,
  workOrderId: string,
): Promise<WorkOrderListStatus | null> {
  const wb = await db.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      plannedDate: true,
      dispatchedAt: true,
      signedAt: true,
      approvedBySupervisor: true,
      assignees: { select: { id: true } },
      invoice: { select: { status: true } },
      tasks: { select: { done: true, startedAt: true, endedAt: true, hours: true } },
    },
  });
  if (!wb) return null;
  const status = deriveWorkOrderStatus({
    plannedDate: wb.plannedDate,
    assigneeCount: wb.assignees.length,
    dispatchedAt: wb.dispatchedAt,
    signedAt: wb.signedAt,
    approvedBySupervisor: wb.approvedBySupervisor,
    invoiceStatus: wb.invoice?.status ?? null,
    tasks: wb.tasks,
  });
  await db.workOrder.update({
    where: { id: workOrderId },
    data: { listStatus: status },
  });
  return status;
}

// Recompute + persist listStatus for EVERY work order of a project. Used when a
// project-level input changes (urgency), which affects all its work orders at once.
export async function recomputeWorkOrdersForProject(
  db: Db,
  projectId: string,
): Promise<void> {
  const workOrders = await db.workOrder.findMany({
    where: { projectId },
    select: {
      id: true,
      plannedDate: true,
      dispatchedAt: true,
      signedAt: true,
      approvedBySupervisor: true,
      assignees: { select: { id: true } },
      invoice: { select: { status: true } },
      tasks: { select: { done: true, startedAt: true, endedAt: true, hours: true } },
    },
  });
  for (const wb of workOrders) {
    const status = deriveWorkOrderStatus({
      plannedDate: wb.plannedDate,
      assigneeCount: wb.assignees.length,
      dispatchedAt: wb.dispatchedAt,
      signedAt: wb.signedAt,
      approvedBySupervisor: wb.approvedBySupervisor,
      invoiceStatus: wb.invoice?.status ?? null,
      tasks: wb.tasks,
    });
    await db.workOrder.update({ where: { id: wb.id }, data: { listStatus: status } });
  }
}

// Backfill helper (used by the data migration + tests): recompute for all work
// orders in the DB. Batches by project to reuse the per-project path.
export async function backfillAllWorkOrderStatuses(): Promise<void> {
  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const p of projects) {
    await recomputeWorkOrdersForProject(prisma, p.id);
  }
}
