import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db/client.js";

// Denormalized work-order list status. The value is DERIVED from project urgency
// + task completion, but persisted on WorkOrder.listStatus so the list endpoint
// can filter/count/paginate on a real indexed column. This module is the single
// source of both the derivation and the sync — call recomputeWorkOrderStatus at
// every mutation boundary that can change the inputs.

export type WorkOrderListStatus = "open" | "on_the_way" | "urgent" | "done";

// A prisma client or an interactive-transaction client — both expose the model
// delegates we use, so recompute can run inside or outside a $transaction.
type Db = PrismaClient | Prisma.TransactionClient;

// Inputs needed to derive the status: sign-off, the werkbon's OWN urgency +
// each task's done/startedAt. Pure function — no I/O. Blocked is deliberately
// NOT an input: it's project workflow state ("cannot proceed"), and mapping it
// to "urgent" told monteurs to hurry on stalled jobs.
//
// SIGN-OFF WINS. A signed work order is finished, full stop — it reports "done"
// even when urgent, and even when it has no tasks at all. Without this, an
// urgent work order could never reach "done" (urgency returned first), and a
// task-less one stayed "open" forever (the tasks.length check below) — both
// showed as unfinished in the list after being signed.
export function deriveWorkOrderStatus(input: {
  urgency: string;
  signedAt: Date | string | null;
  tasks: { done: boolean; startedAt: string | null }[];
}): WorkOrderListStatus {
  if (input.signedAt) return "done";
  if (input.urgency === "urgent") return "urgent";
  const { tasks } = input;
  if (tasks.length > 0 && tasks.every((t) => t.done)) return "done";
  if (tasks.some((t) => t.done || t.startedAt)) return "on_the_way";
  return "open";
}

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
      signedAt: true,
      urgency: true,
      tasks: { select: { done: true, startedAt: true } },
    },
  });
  if (!wb) return null;
  const status = deriveWorkOrderStatus({
    urgency: wb.urgency,
    signedAt: wb.signedAt,
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
      signedAt: true,
      urgency: true,
      tasks: { select: { done: true, startedAt: true } },
    },
  });
  for (const wb of workOrders) {
    const status = deriveWorkOrderStatus({
      urgency: wb.urgency,
      signedAt: wb.signedAt,
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
