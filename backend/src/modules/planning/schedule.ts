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
// Exported so the werkbon PATCH can validate a one-sided time change against
// what the slot would actually get.
export const DEFAULT_START_TIME = "08:00";
export const DEFAULT_END_TIME = "15:30";
const DEFAULT_VEHICLE = "Bus - nog toewijzen";

// The werkbon shape the service needs. Callers already load this for their own
// permission checks, so it's passed in rather than re-read.
export type SchedulableWorkOrder = {
  id: string;
  projectId: string;
  plannedDate: string | null;
  plannedEndDate: string | null;
  planningItems: { id: string; date: string }[];
  assignees: { id: string }[];
  project: { projectLeaderId: string | null; teamLeaderId: string | null };
};

export type ApplyScheduleInput = {
  /** The (new) start date, "YYYY-MM-DD". */
  date?: string;
  /** Exact workdays. Supplying this replaces the complete set of days. */
  dates?: string[];
  /** Existing day being moved by drag and drop. */
  sourceDate?: string;
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
 * New multi-day schedules use one slot per explicitly selected workday. The
 * legacy single-slot plus plannedEndDate range remains supported while old
 * records are converted the next time the office edits their dates.
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
  const { startTime, endTime, teamLeaderId, vehicle } = input;
  const exactDates = input.dates
    ? [...new Set(input.dates)].filter(Boolean).sort()
    : null;

  if (exactDates) {
    if (exactDates.length === 0) return;
    const existingSlots = await tx.planningItem.findMany({
      where: { workOrderId: workOrder.id },
      orderBy: { date: "asc" },
      include: { installers: { select: { id: true } } },
    });
    const template = existingSlots[0];

    await tx.planningItem.deleteMany({ where: { workOrderId: workOrder.id } });
    for (const date of exactDates) {
      const createData: Prisma.PlanningItemCreateInput = {
        workOrder: { connect: { id: workOrder.id } },
        date,
        startTime: startTime ?? template?.startTime ?? DEFAULT_START_TIME,
        endTime: endTime ?? template?.endTime ?? DEFAULT_END_TIME,
        vehicle: vehicle ?? template?.vehicle ?? DEFAULT_VEHICLE,
        installers: {
          connect: (template?.installers.length
            ? template.installers
            : workOrder.assignees
          ).map((person) => ({ id: person.id })),
        },
      };
      const projectLeaderId = template?.projectLeaderId ?? workOrder.project.projectLeaderId;
      if (projectLeaderId) {
        createData.projectLeader = { connect: { id: projectLeaderId } };
      }
      const slotTeamLeaderId =
        teamLeaderId !== undefined
          ? teamLeaderId
          : template?.teamLeaderId ?? workOrder.project.teamLeaderId;
      if (slotTeamLeaderId) {
        createData.teamLeader = { connect: { id: slotTeamLeaderId } };
      }
      await tx.planningItem.create({ data: createData });
    }

    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        plannedDate: exactDates[0],
        plannedEndDate: exactDates.length > 1 ? exactDates.at(-1) : null,
      },
    });
    await audit(tx, user, "planning.schedule", "workOrder", workOrder.id, {
      dates: exactDates,
      teamLeaderId,
    });
    return;
  }

  const date = input.date;
  if (!date) return;

  if (input.sourceDate) {
    const slot = workOrder.planningItems.find((item) => item.date === input.sourceDate);
    if (slot) {
      await tx.planningItem.update({
        where: { id: slot.id },
        data: {
          date,
          ...(startTime !== undefined ? { startTime } : {}),
          ...(endTime !== undefined ? { endTime } : {}),
        },
      });
      const days = (
        await tx.planningItem.findMany({
          where: { workOrderId: workOrder.id },
          select: { date: true },
          orderBy: { date: "asc" },
        })
      ).map((item) => item.date);
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          plannedDate: days[0] ?? date,
          plannedEndDate: days.length > 1 ? days.at(-1) : null,
        },
      });
      await audit(tx, user, "planning.schedule", "workOrder", workOrder.id, {
        date,
        sourceDate: input.sourceDate,
      });
      return;
    }
  }
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
