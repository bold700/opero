export const projectLifecycleStatusIds = [
  "new",
  "work_preparation",
  "scheduled",
  "in_progress",
  "ready_to_invoice",
  "invoiced",
  "completed",
  "history",
] as const;

export type ProjectLifecycleStatus =
  (typeof projectLifecycleStatusIds)[number];

export type ProjectLifecycleWorkOrder = {
  plannedDate: string | null;
  signedAt: Date | string | null;
  listStatus: string;
  assignees: readonly unknown[];
  invoice: { status: string } | null;
  tasks: readonly {
    done: boolean;
    startedAt: string | null;
    endedAt: string | null;
    hours: number | null;
  }[];
};

function workHasStarted(workOrder: ProjectLifecycleWorkOrder): boolean {
  return (
    [
      "in_progress",
      "ready_for_review",
      "approved",
      "ready_to_invoice",
      "invoiced",
      "completed",
      // Legacy values remain readable while old environments migrate.
      "on_the_way",
      "done",
    ].includes(workOrder.listStatus) ||
    workOrder.tasks.some(
      (task) =>
        task.done ||
        task.startedAt !== null ||
        task.endedAt !== null ||
        (task.hours ?? 0) > 0,
    )
  );
}

/**
 * Derive the project's user-facing lifecycle from the actual work records.
 *
 * This is intentionally not a second stored status: scheduling, timers,
 * signatures and invoices already are the source of truth. Deriving the label
 * on read means reopening or correcting a record also moves the project back to
 * the right step without a separate synchronization job.
 */
export function deriveProjectLifecycleStatus(input: {
  archived: boolean;
  workOrders: readonly ProjectLifecycleWorkOrder[];
}): ProjectLifecycleStatus {
  if (input.archived) return "history";

  const workOrders = input.workOrders;
  if (workOrders.length === 0) return "new";

  if (
    workOrders.every(
      (workOrder) => workOrder.invoice?.status === "paid",
    )
  ) {
    return "completed";
  }

  if (
    workOrders.every((workOrder) =>
      ["sent", "paid"].includes(workOrder.invoice?.status ?? ""),
    )
  ) {
    return "invoiced";
  }

  if (
    workOrders.every(
      (workOrder) =>
        ["approved", "ready_to_invoice", "invoiced", "completed"].includes(
          workOrder.listStatus,
        ) ||
        (workOrder.listStatus === "done" && workOrder.signedAt !== null),
    )
  ) {
    return "ready_to_invoice";
  }

  if (workOrders.some(workHasStarted)) return "in_progress";

  if (
    workOrders.every(
      (workOrder) =>
        workOrder.plannedDate !== null && workOrder.assignees.length > 0,
    )
  ) {
    return "scheduled";
  }

  return "work_preparation";
}
