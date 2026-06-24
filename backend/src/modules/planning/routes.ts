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
import {
  planningProjectInclude,
  planningEntriesForProject,
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

// Append a ProjectActivity row inside a transaction (mirror makeActivity +
// logChange from the store).
async function appendActivity(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  type: "status_change" | "comment" | "scheduled" | "system",
  body: string,
  statuses?: {
    fromStatus: "sales" | "operations" | "closing";
    toStatus: "sales" | "operations" | "closing";
  },
): Promise<void> {
  await tx.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      type,
      body,
      fromStatus: statuses?.fromStatus,
      toStatus: statuses?.toStatus,
    },
  });
}

// Reject client outright (Planning = client NONE). admin + technician continue;
// technician is read-only and own-scoped (enforced by projectScopeWhere).
function assertNotClient(user: AuthUser): void {
  if (user.role === "client") throw Forbidden("Not available");
}

// Load a project scoped to org + role visibility, throw 404 if not visible.
// Used by the admin write paths (visibility for admin is unrestricted).
async function loadProjectForUser(user: AuthUser, id: string) {
  const project = await prisma.project.findFirst({
    where: projectScopeWhere(user, { id }),
    include: {
      quote: { select: { status: true } },
      materialRequirements: true,
      installers: { select: { id: true } },
    },
  });
  if (!project) throw NotFound("Project not found");
  return project;
}

// Mirror getProjectMaterialReadiness === "available".
function materialsAvailable(
  reqs: { quantityInStock: number; quantityNeeded: number }[],
): boolean {
  if (reqs.length === 0) return false;
  return reqs.every((r) => r.quantityInStock >= r.quantityNeeded);
}

// Reload a project as planning entries (after a write).
async function reloadEntries(
  user: AuthUser,
  projectId: string,
): Promise<PlanningEntry[]> {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: planningProjectInclude,
  });
  return planningEntriesForProject(p);
}

// =========================================================================
// CALENDAR FEED
// =========================================================================

// GET /?from=&to=&view= — flat calendar feed. admin: whole org; technician: only
// projects they're assigned to (teamLeader/projectLeader/installer). client: 403.
// A project is "on the calendar" if it has PlanningItems or a plannedDate.
planningRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertNotClient(user);
    const { from, to } = calendarQuerySchema.parse(req.query);

    const projects = await prisma.project.findMany({
      where: projectScopeWhere(user, {
        OR: [
          { plannedDate: { not: null } },
          { planningItems: { some: {} } },
        ],
      }),
      include: planningProjectInclude,
      orderBy: { plannedDate: "asc" },
    });

    // Flatten to entries, then filter by the [from, to] inclusive date window
    // (string compare on YYYY-MM-DD, matching the store's date semantics).
    const entries = projects
      .flatMap(planningEntriesForProject)
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

// GET /route?date= — planned projects for a day, ordered by address (MVP: a
// simple ordered list, no real routing). admin: org-wide; technician: own. client: 403.
planningRouter.get(
  "/route",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    assertNotClient(user);
    const { date } = routeQuerySchema.parse(req.query);
    const day = date ?? todayIso();

    const projects = await prisma.project.findMany({
      where: projectScopeWhere(user, {
        OR: [
          { plannedDate: day },
          { planningItems: { some: { date: day } } },
        ],
      }),
      include: planningProjectInclude,
      orderBy: { address: "asc" },
    });

    // One entry per project for that day. Prefer a matching PlanningItem; fall
    // back to the date-only entry. Ordered by project.address (DB orderBy).
    const stops = projects.flatMap((p) => {
      const entries = planningEntriesForProject(p).filter((e) => e.date === day);
      return entries.map((e) => ({
        ...e,
        address: p.address,
        postalCode: p.postalCode,
        city: p.city,
      }));
    });

    res.json({ date: day, stops });
  }),
);

// =========================================================================
// SCHEDULE A SLOT — admin only
// =========================================================================

// POST /projects/:projectId/planning — create/replace a PlanningItem and set
// plannedDate. Mirrors schedulePlanningSlot + scheduleProjectOnDay: updates the
// first PlanningItem in place (or creates one with the store defaults),
// preserves project duration by shifting plannedEndDate, and advances a
// sales+accepted project to operations. Adds a "scheduled" activity.
planningRouter.post(
  "/projects/:projectId/planning",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = schedulePlanningSchema.parse(req.body);
    const date = clampText(input.date).trim();
    if (!date) throw BadRequest("date required");

    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.projectId }),
      include: {
        quote: { select: { status: true } },
        planningItems: { orderBy: { date: "asc" } },
        installers: { select: { id: true } },
      },
    });
    if (!existing) throw NotFound("Project not found");

    const teamLeaderId =
      input.teamLeaderId !== undefined
        ? input.teamLeaderId || null
        : undefined;
    const startTime = input.startTime ? clampText(input.startTime) : undefined;
    const endTime = input.endTime ? clampText(input.endTime) : undefined;
    const vehicle =
      input.vehicle !== undefined ? clampText(input.vehicle) : undefined;

    // Preserve looptijd: shift plannedEndDate by the same span (mirror
    // scheduleProjectOnDay).
    const oldStart = existing.plannedDate;
    const oldEnd = existing.plannedEndDate ?? existing.plannedDate;
    const spanMs =
      oldStart && oldEnd ? Date.parse(oldEnd) - Date.parse(oldStart) : 0;
    const newEnd =
      spanMs > 0
        ? new Date(Date.parse(date) + spanMs).toISOString().slice(0, 10)
        : null;

    const shouldAdvance =
      existing.status === "sales" && existing.quote?.status === "accepted";

    const leader =
      teamLeaderId != null
        ? await prisma.employee.findFirst({
            where: { id: teamLeaderId, orgId: user.orgId },
          })
        : null;

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
        // Create a new slot with the store defaults: 08:00–15:30, installers
        // copied from the project, vehicle "Bus - nog toewijzen".
        const createData: Prisma.PlanningItemCreateInput = {
          project: { connect: { id: existing.id } },
          date,
          startTime: startTime ?? "08:00",
          endTime: endTime ?? "15:30",
          vehicle: vehicle ?? "Bus - nog toewijzen",
          installers: {
            connect: existing.installers.map((i) => ({ id: i.id })),
          },
        };
        if (existing.projectLeaderId) {
          createData.projectLeader = {
            connect: { id: existing.projectLeaderId },
          };
        }
        const slotTeamLeaderId = teamLeaderId ?? existing.teamLeaderId;
        if (slotTeamLeaderId) {
          createData.teamLeader = { connect: { id: slotTeamLeaderId } };
        }
        await tx.planningItem.create({ data: createData });
      }

      // Update the project: plannedDate/end, status advance, and propagate the
      // chosen teamLeaderId onto the project (mirror schedulePlanningSlot).
      const projectData: Prisma.ProjectUpdateInput = {
        plannedDate: date,
        plannedEndDate: newEnd,
      };
      if (teamLeaderId !== undefined) {
        projectData.teamLeader = teamLeaderId
          ? { connect: { id: teamLeaderId } }
          : { disconnect: true };
      }
      if (shouldAdvance) {
        projectData.status = "operations";
        projectData.nextStep = "Werkorder voorbereiden";
      }
      await tx.project.update({ where: { id: existing.id }, data: projectData });

      await appendActivity(
        tx,
        user,
        existing.id,
        "scheduled",
        `Ingepland op ${date}${leader ? ` (team ${leader.name})` : ""}`,
      );
      await audit(tx, user, "planning.schedule", "project", existing.id, {
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

// PATCH /projects/:projectId/planning/duration {days} — setProjectDurationDays.
// plannedEndDate = plannedDate + (days-1); days<=1 clears the end date.
planningRouter.patch(
  "/projects/:projectId/planning/duration",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { days } = durationSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.projectId);
    if (!existing.plannedDate) {
      throw BadRequest("Project has no plannedDate");
    }

    const clamped = Math.max(1, Math.round(days));
    const end =
      clamped <= 1
        ? null
        : new Date(Date.parse(existing.plannedDate) + (clamped - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10);

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: { plannedEndDate: end },
      });
      await audit(tx, user, "planning.duration", "project", existing.id, {
        days: clamped,
      });
    });

    res.json(await reloadEntries(user, existing.id));
  }),
);

// =========================================================================
// UNSCHEDULE — admin only
// =========================================================================

// DELETE /projects/:projectId/planning — unscheduleProject: clear
// plannedDate/plannedEndDate and remove all PlanningItems for the project.
planningRouter.delete(
  "/projects/:projectId/planning",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadProjectForUser(user, req.params.projectId);

    await prisma.$transaction(async (tx) => {
      await tx.planningItem.deleteMany({ where: { projectId: existing.id } });
      await tx.project.update({
        where: { id: existing.id },
        data: { plannedDate: null, plannedEndDate: null },
      });
      await audit(tx, user, "planning.unschedule", "project", existing.id);
    });

    res.status(204).end();
  }),
);

// =========================================================================
// MARK PLANNED — admin only
// =========================================================================

// POST /projects/:projectId/planning/mark-planned — markProjectPlanned. Guarded
// by canMoveToPlanned (status operations + materials available). Sets status
// operations, ensures a plannedDate, creates a PlanningItem if none exists, and
// logs a status_change activity.
planningRouter.post(
  "/projects/:projectId/planning/mark-planned",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadProjectForUser(user, req.params.projectId);

    // canMoveToPlanned: status === "operations" && materials available.
    const available = materialsAvailable(existing.materialRequirements);
    if (existing.status !== "operations" || !available) {
      throw BadRequest("Project cannot be marked planned");
    }

    const planningItems = await prisma.planningItem.findMany({
      where: { projectId: existing.id },
    });
    const fromStatus = existing.status;
    // Mirror the store's fallback default plannedDate.
    const plannedDate = existing.plannedDate ?? "2026-05-20";

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          status: "operations",
          nextStep: "Werkorder voorbereiden",
          plannedDate,
        },
      });

      if (planningItems.length === 0) {
        const createData: Prisma.PlanningItemCreateInput = {
          project: { connect: { id: existing.id } },
          date: plannedDate,
          startTime: "08:00",
          endTime: "15:30",
          vehicle: "Bus 8 - Transit",
          installers: {
            connect: existing.installers.map((i) => ({ id: i.id })),
          },
        };
        if (existing.projectLeaderId) {
          createData.projectLeader = {
            connect: { id: existing.projectLeaderId },
          };
        }
        if (existing.teamLeaderId) {
          createData.teamLeader = { connect: { id: existing.teamLeaderId } };
        }
        await tx.planningItem.create({ data: createData });
      }

      await appendActivity(
        tx,
        user,
        existing.id,
        "status_change",
        "Project ingepland",
        { fromStatus, toStatus: "operations" },
      );
      await audit(tx, user, "planning.markPlanned", "project", existing.id);
    });

    res.json(await reloadEntries(user, existing.id));
  }),
);
