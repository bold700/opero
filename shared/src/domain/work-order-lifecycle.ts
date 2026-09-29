export const workOrderStatusIds = [
  "open",
  "planned",
  "released",
  "in_progress",
  "ready_for_review",
  "approved",
  "ready_to_invoice",
  "invoiced",
  "completed",
] as const;

export type WorkOrderStatus = (typeof workOrderStatusIds)[number];

export const workOrderPhaseIds = [
  "preparation",
  "realization",
  "completion",
] as const;

export type WorkOrderPhase = (typeof workOrderPhaseIds)[number];

export type WorkOrderLifecycleInput = {
  plannedDate: string | null;
  assigneeCount: number;
  dispatchedAt: Date | string | null;
  signedAt: Date | string | null;
  approvedBySupervisor: boolean;
  invoiceStatus: string | null;
  tasks: readonly {
    done: boolean;
    startedAt: string | null;
    endedAt?: string | null;
    hours?: number | null;
  }[];
};

export function workOrderPhaseForStatus(
  status: WorkOrderStatus,
): WorkOrderPhase {
  if (["open", "planned", "released"].includes(status)) return "preparation";
  if (["in_progress", "ready_for_review", "approved"].includes(status)) {
    return "realization";
  }
  return "completion";
}

/**
 * Derive the work-order lifecycle from the records that prove each transition.
 * Priority is deliberately absent: an urgent visit remains in its real phase.
 */
export function deriveWorkOrderStatus(
  input: WorkOrderLifecycleInput,
): WorkOrderStatus {
  if (input.invoiceStatus === "paid") return "completed";
  if (input.invoiceStatus === "sent") return "invoiced";
  if (input.invoiceStatus === "draft") return "ready_to_invoice";
  if (input.approvedBySupervisor && input.signedAt) return "approved";

  const allTasksDone =
    input.tasks.length > 0 && input.tasks.every((task) => task.done);
  if (input.signedAt || allTasksDone) return "ready_for_review";

  const workStarted = input.tasks.some(
    (task) =>
      task.done ||
      task.startedAt !== null ||
      task.endedAt != null ||
      (task.hours ?? 0) > 0,
  );
  if (workStarted) return "in_progress";
  if (input.dispatchedAt) return "released";
  if (input.plannedDate && input.assigneeCount > 0) return "planned";
  return "open";
}

// An office override is authoritative until the next normal lifecycle action.
// Unknown persisted values safely fall back to the derived state.
export function resolveWorkOrderStatus(
  input: WorkOrderLifecycleInput,
  override?: string | null,
): WorkOrderStatus {
  return override && (workOrderStatusIds as readonly string[]).includes(override)
    ? (override as WorkOrderStatus)
    : deriveWorkOrderStatus(input);
}

export const terminalWorkOrderStatusIds: readonly WorkOrderStatus[] = [
  "ready_for_review",
  "approved",
  "ready_to_invoice",
  "invoiced",
  "completed",
];
