import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../../auth/types.js";
import { audit } from "../../lib/audit.js";

// THE single write path for "when is this werkbon".
//
// A werkbon's schedule lives in TWO stores: WorkOrder.plannedDate/plannedEndDate
// (what the werkbon detail + list filters read) and PlanningItem (what the
// calendar draws, and which SHADOWS plannedDate — see planningEntriesForWorkOrder
// in ./dto.ts, which only falls back to plannedDate when no item exists).
//
// Writing one without the other is how the two screens end up disagreeing: the
// werkbon says 14 Oct while the calendar still draws the stale slot on 3 May.
// Both the planning routes and the werkbon PATCH funnel through here so that
// can't happen by construction.
//
// Callers pass their own `tx` — the slot, the werkbon columns and the audit row
// must commit together or not at all.

type Tx = Prisma.TransactionClient;

// Defaults for a slot created from a bare date (no times/crew supplied).
const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "15:30";
const DEFAULT_VEHICLE = "Bus - nog toewijzen";

// The werkbon shape the service needs. Callers already load this for their own
// permission checks, so it's passed in rather than re-read.
export type SchedulableWorkOrder = {
  id: string;
  projectId: string;
  plannedDate: string | null;
  plannedEndDate: string | null;
  planningItems: { id: string }[];
  assignees: { id: string }[];
  project: { projectLeaderId: string | null; teamLeaderId: string | null };
};

export type ApplyScheduleInput = {
  /** The (new) start date, "YYYY-MM-DD". */
  date: string;
  /**
   * Explicit end date. Omit to preserve the werkbon's existing duration by
   * shifting the end by the same span (the planning route's behaviour); pass
   * null to clear it.
   */
  endDate?: string | null;
  startTime?: string;
  endTime?: string;
  teamLeaderId?: string | null;
  vehicle?: string;
};

/**
 * Shift the end date by the same span the werkbon already had, so moving a
 * multi-day job keeps its looptijd. Returns null when there was no range.
 */
export function shiftedEndDate(
  workOrder: Pick<SchedulableWorkOrder, "plannedDate" | "plannedEndDate">,
  newStart: string,
): string | null {
  const oldStart = workOrder.plannedDate;
  const oldEnd = workOrder.plannedEndDate ?? workOrder.plannedDate;
  const spanMs =
    oldStart && oldEnd ? Date.parse(oldEnd) - Date.parse(oldStart) : 0;
  return spanMs > 0
    ? new Date(Date.parse(newStart) + spanMs).toISOString().slice(0, 10)
    : null;
}

/**
 * Set/move the werkbon's schedule: upsert its PlanningItem AND write
 * plannedDate/plannedEndDate.
 *
 * Multi-day is modelled as ONE slot on the start date plus a plannedEndDate
 * range (not one slot per day) — the calendar entry carries plannedEndDate, so
 * the renderer has the span without N rows to keep in sync.
 *
 * Only the date moves on an existing slot: its times, crew and vehicle are
 * preserved unless explicitly passed. That's what lets the werkbon date field
 * reschedule without clobbering what the office set up on the Planning screen.
 *
 * Does NOT check permissions or absences — callers own those (they differ per
 * entry point).
 */
export async function applyWorkOrderSchedule(
  tx: Tx,
  user: AuthUser,
  workOrder: SchedulableWorkOrder,
  input: ApplyScheduleInput,
): Promise<void> {
  const { date, startTime, endTime, teamLeaderId, vehicle } = input;
  const plannedEndDate =
    input.endDate !== undefined ? input.endDate : shiftedEndDate(workOrder, date);

  const first = workOrder.planningItems[0];
  if (first) {
    // Update the existing slot in place — keeps times/crew/vehicle.
    await tx.planningItem.update({
      where: { id: first.id },
      data: {
        date,
        ...(teamLeaderId !== undefined
          ? {
              teamLeader: teamLeaderId
                ? { connect: { id: teamLeaderId } }
                : { disconnect: true },
            }
          : {}),
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
        ...(vehicle !== undefined ? { vehicle } : {}),
      },
    });
  } else {
    // Create a slot with the store defaults: 08:00–15:30, crew copied from the
    // werkbon's assignees, vehicle "Bus - nog toewijzen".
    const createData: Prisma.PlanningItemCreateInput = {
      workOrder: { connect: { id: workOrder.id } },
      date,
      startTime: startTime ?? DEFAULT_START_TIME,
      endTime: endTime ?? DEFAULT_END_TIME,
      vehicle: vehicle ?? DEFAULT_VEHICLE,
      installers: { connect: workOrder.assignees.map((a) => ({ id: a.id })) },
    };
    if (workOrder.project.projectLeaderId) {
      createData.projectLeader = {
        connect: { id: workOrder.project.projectLeaderId },
      };
    }
    const slotTeamLeaderId = teamLeaderId ?? workOrder.project.teamLeaderId;
    if (slotTeamLeaderId) {
      createData.teamLeader = { connect: { id: slotTeamLeaderId } };
    }
    await tx.planningItem.create({ data: createData });
  }

  await tx.workOrder.update({
    where: { id: workOrder.id },
    data: { plannedDate: date, plannedEndDate },
  });

  await audit(tx, user, "planning.schedule", "workOrder", workOrder.id, {
    date,
    teamLeaderId,
  });
}

/**
 * Unschedule: clear plannedDate/plannedEndDate AND delete every PlanningItem.
 *
 * Deleting the slots is the point — leaving them behind would keep the werkbon
 * on the calendar (the item shadows the now-null plannedDate), so "I removed
 * the date" wouldn't take.
 */
export async function clearWorkOrderSchedule(
  tx: Tx,
  user: AuthUser,
  workOrder: Pick<SchedulableWorkOrder, "id">,
): Promise<void> {
  await tx.planningItem.deleteMany({ where: { workOrderId: workOrder.id } });
  await tx.workOrder.update({
    where: { id: workOrder.id },
    data: { plannedDate: null, plannedEndDate: null },
  });
  await audit(tx, user, "planning.unschedule", "workOrder", workOrder.id);
}

/**
 * Set only the end date (the start is unchanged), so the single slot stays put.
 */
export async function setWorkOrderEndDate(
  tx: Tx,
  user: AuthUser,
  workOrder: Pick<SchedulableWorkOrder, "id">,
  plannedEndDate: string | null,
): Promise<void> {
  await tx.workOrder.update({
    where: { id: workOrder.id },
    data: { plannedEndDate },
  });
  await audit(tx, user, "planning.duration", "workOrder", workOrder.id, {
    plannedEndDate,
  });
}
