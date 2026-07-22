import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import type { AuthUser } from "../../auth/types.js";
import { projectScopeWhere } from "../projects/visibility.js";
import { absencesInRange } from "../employees/absence.js";
import {
  planningWorkOrderInclude,
  planningEntriesForWorkOrder,
  type PlanningEntry,
} from "./dto.js";
import {
  calendarQuerySchema,
  routeQuerySchema,
  schedulePlanningSchema,
  durationSchema,
} from "./schema.js";

export const planningRouter = Router();

planningRouter.use(requireAuth);

// --- local helpers --------------------------------------------------------

type Tx = Prisma.TransactionClient;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// A werkbon is visible if its parent project is visible. Reuse projectScopeWhere
// (org + soft-delete + role visibility) nested under `project`, then AND the
// werkbon-level constraints so both always hold (never let one OR clobber the
// other — see visibility.ts).
function workOrderScopeWhere(
  user: AuthUser,
  extra?: Prisma.WorkOrderWhereInput,
): Prisma.WorkOrderWhereInput {
  return {
    AND: [
      { project: projectScopeWhere(user) },
      ...(extra ? [extra] : []),
    ],
  };
}

// Append a ProjectActivity row inside a transaction (mirror makeActivity +
// logChange from the store).
// Stores a language-neutral messageKey + params (rendered client-side via i18n).
// Internals are English; no display prose is stored.
async function appendActivity(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  type: "status_change" | "comment" | "scheduled" | "system",
  messageKey: string,
  opts?: {
    params?: Record<string, unknown>;
    statuses?: {
      fromStatus: "sales" | "operations" | "closing";
      toStatus: "sales" | "operations" | "closing";
    };
  },
): Promise<void> {
  await tx.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      type,
      messageKey,
      params: (opts?.params ?? undefined) as Prisma.InputJsonValue | undefined,
      fromStatus: opts?.statuses?.fromStatus,
      toStatus: opts?.statuses?.toStatus,
    },
  });
}

// Reject client outright (Planning = client NONE). admin + technician continue;
// technician is read-only and own-scoped (enforced by workOrderScopeWhere).
function assertNotClient(user: AuthUser): void {
  if (user.role === "client") throw Forbidden("Not available");
}

// Load a werkbon scoped to org + role visibility (via its project), throw 404 if
// not visible. Includes the parent project + crew needed by the write paths.
async function loadWorkOrderForUser(user: AuthUser, id: string) {
  const workOrder = await prisma.workOrder.findFirst({
    where: workOrderScopeWhere(user, { id }),
    include: {
      quote: { select: { status: true } },
      assignees: { select: { id: true } },
      project: {
        select: {
          id: true,
          status: true,
          projectLeaderId: true,
          teamLeaderId: true,
          materialRequirements: true,
        },
      },
    },
  });
  if (!workOrder) throw NotFound("Work order not found");
  return workOrder;
}

// Mirror getProjectMaterialReadiness === "available".
function materialsAvailable(
  reqs: { quantityInStock: number; quantityNeeded: number }[],
): boolean {
  if (reqs.length === 0) return false;
  return reqs.every((r) => r.quantityInStock >= r.quantityNeeded);
}

// Reload a werkbon as planning entries (after a write).
async function reloadEntries(
  user: AuthUser,
  workOrderId: string,
): Promise<PlanningEntry[]> {
  const wo = await prisma.workOrder.findUniqueOrThrow({
    where: { id: workOrderId },
    include: planningWorkOrderInclude,
  });
  return planningEntriesForWorkOrder(wo);
}

// =========================================================================
// CALENDAR FEED
// =========================================================================

// GET /?from=&to=&view= — flat calendar feed. admin: whole org; technician: only
// werkbonnen whose project they're assigned to. client: 403.
// A werkbon is "on the calendar" if it has PlanningItems or a plannedDate.
planningRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertNotClient(user);
    const { from, to } = calendarQuerySchema.parse(req.query);

    const workOrders = await prisma.workOrder.findMany({
      where: workOrderScopeWhere(user, {
        OR: [
          { plannedDate: { not: null } },
          { planningItems: { some: {} } },
        ],
      }),
      include: planningWorkOrderInclude,
      orderBy: { plannedDate: "asc" },
    });

    // Flatten to entries, then filter by the [from, to] inclusive date window
    // (string compare on YYYY-MM-DD, matching the store's date semantics).
    const entries = workOrders
      .flatMap(planningEntriesForWorkOrder)
      .filter((e) => {
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(entries);
  }),
);

// =========================================================================
// ROUTE OVERVIEW
// =========================================================================

// GET /route?date= — planned werkbonnen for a day, ordered by address (MVP: a
// simple ordered list, no real routing). admin: org-wide; technician: own. client: 403.
planningRouter.get(
  "/route",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertNotClient(user);
    const { date } = routeQuerySchema.parse(req.query);
    const day = date ?? todayIso();

    const workOrders = await prisma.workOrder.findMany({
      where: workOrderScopeWhere(user, {
        OR: [
          { plannedDate: day },
          { planningItems: { some: { date: day } } },
        ],
      }),
      include: planningWorkOrderInclude,
      orderBy: { project: { address: "asc" } },
    });

    // One entry per werkbon for that day. Prefer a matching PlanningItem; fall
    // back to the date-only entry. Ordered by project.address (DB orderBy).
    const stops = workOrders.flatMap((wo) => {
      const entries = planningEntriesForWorkOrder(wo).filter(
        (e) => e.date === day,
      );
      return entries.map((e) => ({
        ...e,
        address: wo.project.address,
        postalCode: wo.project.postalCode,
        city: wo.project.city,
      }));
    });

    res.json({ date: day, stops });
  }),
);

// =========================================================================
// SCHEDULE A SLOT — admin only
// =========================================================================

// POST /work-orders/:workOrderId/planning — create/replace a PlanningItem and
// set the werkbon's plannedDate. Updates the first PlanningItem in place (or
// creates one with the store defaults), preserving the werkbon's duration by
// shifting plannedEndDate. Adds a "scheduled" activity on the parent project.
planningRouter.post(
  "/work-orders/:workOrderId/planning",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = schedulePlanningSchema.parse(req.body);
    const date = clampText(input.date).trim();
    if (!date) throw BadRequest("date required");

    const existing = await prisma.workOrder.findFirst({
      where: workOrderScopeWhere(user, { id: req.params.workOrderId }),
      include: {
        planningItems: { orderBy: { date: "asc" } },
        assignees: { select: { id: true } },
        project: { select: { id: true, projectLeaderId: true, teamLeaderId: true } },
      },
    });
    if (!existing) throw NotFound("Work order not found");

    const teamLeaderId =
      input.teamLeaderId !== undefined
        ? input.teamLeaderId || null
        : undefined;
    const startTime = input.startTime ? clampText(input.startTime) : undefined;
    const endTime = input.endTime ? clampText(input.endTime) : undefined;
    const vehicle =
      input.vehicle !== undefined ? clampText(input.vehicle) : undefined;

    // Preserve looptijd: shift plannedEndDate by the same span.
    const oldStart = existing.plannedDate;
    const oldEnd = existing.plannedEndDate ?? existing.plannedDate;
    const spanMs =
      oldStart && oldEnd ? Date.parse(oldEnd) - Date.parse(oldStart) : 0;
    const newEnd =
      spanMs > 0
        ? new Date(Date.parse(date) + spanMs).toISOString().slice(0, 10)
        : null;

    const leader =
      teamLeaderId != null
        ? await prisma.employee.findFirst({
            where: { id: teamLeaderId, orgId: user.orgId },
          })
        : null;

    // Don't schedule someone who is on holiday / off sick that day ("so
    // employees are automatically not scheduled" — WOB Isolatie, 17-07-2026).
    // Checked across the whole run (date → newEnd), not just the start day, so
    // a multi-day job that runs into a holiday is caught too.
    //
    // Refusing outright rather than warning: the office picked this person
    // explicitly, and silently scheduling them anyway is how a job ends up with
    // nobody on site. The absence can be shortened or the leader changed.
    if (teamLeaderId) {
      const absent = await absencesInRange(
        user.orgId,
        date,
        newEnd ?? date,
        [teamLeaderId],
      );
      if (absent.length > 0) {
        const a = absent[0];
        throw BadRequest(
          `${a.employee.name} is unavailable ${a.startDate} – ${a.endDate} (${a.kind})`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const first = existing.planningItems[0];
      if (first) {
        // Update the existing slot in place (mirror existing-item branch).
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
        // Create a new slot with the store defaults: 08:00–15:30, crew copied
        // from the werkbon's assignees, vehicle "Bus - nog toewijzen".
        const createData: Prisma.PlanningItemCreateInput = {
          workOrder: { connect: { id: existing.id } },
          date,
          startTime: startTime ?? "08:00",
          endTime: endTime ?? "15:30",
          vehicle: vehicle ?? "Bus - nog toewijzen",
          installers: {
            connect: existing.assignees.map((a) => ({ id: a.id })),
          },
        };
        if (existing.project.projectLeaderId) {
          createData.projectLeader = {
            connect: { id: existing.project.projectLeaderId },
          };
        }
        const slotTeamLeaderId = teamLeaderId ?? existing.project.teamLeaderId;
        if (slotTeamLeaderId) {
          createData.teamLeader = { connect: { id: slotTeamLeaderId } };
        }
        await tx.planningItem.create({ data: createData });
      }

      // Update the werkbon: plannedDate/end.
      await tx.workOrder.update({
        where: { id: existing.id },
        data: { plannedDate: date, plannedEndDate: newEnd },
      });

      await appendActivity(
        tx,
        user,
        existing.projectId,
        "scheduled",
        leader ? "planning.scheduledWithTeam" : "planning.scheduled",
        { params: { date, leader: leader?.name } },
      );
      await audit(tx, user, "planning.schedule", "workOrder", existing.id, {
        date,
        teamLeaderId,
      });
    });

    res.status(201).json(await reloadEntries(user, existing.id));
  }),
);

// =========================================================================
// DURATION — admin only
// =========================================================================

// PATCH /work-orders/:workOrderId/planning/duration {days} — set the werkbon's
// duration. plannedEndDate = plannedDate + (days-1); days<=1 clears the end date.
planningRouter.patch(
  "/work-orders/:workOrderId/planning/duration",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { days } = durationSchema.parse(req.body);
    const existing = await loadWorkOrderForUser(user, req.params.workOrderId);
    if (!existing.plannedDate) {
      throw BadRequest("Work order has no plannedDate");
    }

    const clamped = Math.max(1, Math.round(days));
    const end =
      clamped <= 1
        ? null
        : new Date(Date.parse(existing.plannedDate) + (clamped - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10);

    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: existing.id },
        data: { plannedEndDate: end },
      });
      await audit(tx, user, "planning.duration", "workOrder", existing.id, {
        days: clamped,
      });
    });

    res.json(await reloadEntries(user, existing.id));
  }),
);

// =========================================================================
// UNSCHEDULE — admin only
// =========================================================================

// DELETE /work-orders/:workOrderId/planning — unschedule the werkbon: clear
// plannedDate/plannedEndDate and remove all PlanningItems for the werkbon.
planningRouter.delete(
  "/work-orders/:workOrderId/planning",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadWorkOrderForUser(user, req.params.workOrderId);

    await prisma.$transaction(async (tx) => {
      await tx.planningItem.deleteMany({ where: { workOrderId: existing.id } });
      await tx.workOrder.update({
        where: { id: existing.id },
        data: { plannedDate: null, plannedEndDate: null },
      });
      await appendActivity(
        tx,
        user,
        existing.projectId,
        "system",
        "planning.unscheduled",
      );
      await audit(tx, user, "planning.unschedule", "workOrder", existing.id);
    });

    res.status(204).end();
  }),
);

// =========================================================================
// MARK PLANNED — admin only
// =========================================================================

// POST /work-orders/:workOrderId/planning/mark-planned — mark the werkbon
// planned. Guarded by the parent project's readiness (status operations +
// materials available). Ensures a plannedDate, creates a PlanningItem if none
// exists, and logs a status_change activity on the project.
planningRouter.post(
  "/work-orders/:workOrderId/planning/mark-planned",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadWorkOrderForUser(user, req.params.workOrderId);
    const project = existing.project;

    // canMoveToPlanned: parent project status === "operations" && materials available.
    const available = materialsAvailable(project.materialRequirements);
    if (project.status !== "operations" || !available) {
      throw BadRequest("Work order cannot be marked planned");
    }

    const planningItems = await prisma.planningItem.findMany({
      where: { workOrderId: existing.id },
    });
    const fromStatus = project.status;
    // Mirror the store's fallback default plannedDate.
    const plannedDate = existing.plannedDate ?? "2026-05-20";

    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: existing.id },
        data: { plannedDate },
      });

      if (planningItems.length === 0) {
        const createData: Prisma.PlanningItemCreateInput = {
          workOrder: { connect: { id: existing.id } },
          date: plannedDate,
          startTime: "08:00",
          endTime: "15:30",
          vehicle: "Bus 8 - Transit",
          installers: {
            connect: existing.assignees.map((a) => ({ id: a.id })),
          },
        };
        if (project.projectLeaderId) {
          createData.projectLeader = {
            connect: { id: project.projectLeaderId },
          };
        }
        if (project.teamLeaderId) {
          createData.teamLeader = { connect: { id: project.teamLeaderId } };
        }
        await tx.planningItem.create({ data: createData });
      }

      await appendActivity(
        tx,
        user,
        project.id,
        "status_change",
        "planning.projectScheduled",
        {
          statuses: { fromStatus, toStatus: "operations" },
        },
      );
      await audit(tx, user, "planning.markPlanned", "workOrder", existing.id);
    });

    res.json(await reloadEntries(user, existing.id));
  }),
);
