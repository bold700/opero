import type { WorkOrderTask } from "../api";

// A zone (WorkOrderTask) is complete when it has at least one NAMED invoice line
// and every named line is done. Blank rows (no name and no label) are ignored.
// This mirrors the backend's syncTaskDone so the derived badge and the persisted
// task.done never disagree. Status is DERIVED from the lines — there is no
// separate zone-done toggle (the opero-old model).
export function isZoneComplete(task: WorkOrderTask): boolean {
  const named = task.materials.filter(
    (m) => (m.name ?? "").trim() || (m.label ?? "").trim(),
  );
  return named.length > 0 && named.every((m) => m.done);
}
