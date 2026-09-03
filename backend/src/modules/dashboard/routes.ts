import { Router } from "express";
import type { Prisma, ProjectStatus, Stage } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../auth/middleware.js";
import { isOffice } from "@opero/shared";
import { projectScopeWhere } from "../projects/visibility.js";
import { visibleWorkOrdersWhere } from "../work-orders/visibility.js";
import {
  type AdminDashboard,
  type ClientDashboard,
  type TechnicianDashboard,
  clientProjectRow,
  technicianProjectRow,
} from "./dto.js";

export const dashboardRouter = Router();

// All dashboard routes require auth. The payload differs per role, but every
// role is allowed to hit the endpoint (it returns their own scoped view).
dashboardRouter.use(requireAuth);

const PROJECT_STATUSES: ProjectStatus[] = ["sales", "operations", "closing"];
const STAGES: Stage[] = ["concept", "in_progress", "ready", "done"];

// Port of getIsoWeekRange/inThisWeek from dashboard-client.tsx. plannedDate is
// stored as a "YYYY-MM-DD" string, so we compare against ISO date strings.
function isoWeekRange(today = new Date()): { start: string; end: string } {
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Sales & usage period → lower bound on the line's createdAt. Unknown or
// missing → all time (epoch).
export type SalesPeriod = "all" | "month" | "year" | "30d";
function salesPeriodStart(raw: unknown): Date {
  const now = new Date();
  switch (raw) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0);
  }
}

function emptyCount<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

// GET /dashboard — role-aware payload.
dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // -------------------------------------------------------- admin + office
    // Office staff run the same operational overview as the owner. isOffice,
    // NOT canSeeAllProjects: this payload carries money (pipelineValue,
    // invoices) — the foreman sees all projects but never money. NOTE the
    // branches below are exhaustive-by-fallthrough: a role matching neither
    // this nor the field-staff check falls to the client payload, so a new
    // role must be added here explicitly or it gets the wrong dashboard.
    if (isOffice(user.role)) {
      const where = projectScopeWhere(user); // all org projects
      const { start, end } = isoWeekRange();
      // Sales & usage period: lines created since this date ("all" = no bound).
      const salesSince = salesPeriodStart(req.query.salesPeriod);

      const [
        projects,
        plannedThisWeek,
        urgentCount,
        blockedCount,
        openInvoices,
        recentActivity,
        readyToInvoice,
        activeProjects,
        salesRows,
      ] = await Promise.all([
        prisma.project.findMany({
          where,
          select: { status: true, stage: true, value: true },
        }),
        prisma.project.count({
          where: { ...where, workOrders: { some: { plannedDate: { gte: start, lte: end } } } },
        }),
        // Urgency is per-werkbon now: a project counts as urgent when any of
        // its unfinished werkbonnen is. Blocked derives from the blocker state.
        prisma.project.count({
          where: { ...where, workOrders: { some: { urgency: "urgent", signedAt: null } } },
        }),
        prisma.project.count({
          where: { ...where, OR: [{ blocker: { not: null } }, { blockerKey: { not: null } }] },
        }),
        // unpaid/overdue: a werkbon invoice sent or not yet paid (anything not "paid").
        prisma.project.count({
          where: {
            ...where,
            workOrders: { some: { invoice: { is: { status: { in: ["draft", "sent"] } } } } },
          },
        }),
        // recent activity over the org's visible projects in the last 7 days.
        prisma.projectActivity.count({
          where: {
            project: { is: where },
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.project.count({
          where: {
            ...where,
            status: "closing",
            workOrders: {
              some: { invoice: { is: { status: { in: ["not_started", "draft"] } } } },
            },
          },
        }),
        prisma.project.count({
          where: {
            ...where,
            OR: [
              { workOrders: { some: { invoice: { is: { status: { not: "paid" } } } } } },
              { workOrders: { some: { invoice: { is: null } } } },
            ],
          },
        }),
        // Sales/usage rollup over every werkbon line in the org. SQL because
        // Prisma's aggregate can't multiply columns. Money rules mirror the
        // invoice: rejected lines never count; meerwerk counts only once both
        // office and client approved. "Laid" metres = registered usage, else
        // the planned quantity of a line ticked done (a proxy until usage is
        // registered), else 0. Lines carry the unit as the Dutch LABEL
        // ("meter", from LINE_UNIT_LABELS / the custom-line default), so match
        // every spelling, never just "m".
        prisma.$queryRaw<
          { sold: number | null; cost: number | null; meters: number | null }[]
        >`
          SELECT
            SUM(tm.quantity * COALESCE(tm."unitPrice", 0))                            AS sold,
            SUM(tm.quantity * COALESCE(tm."costPrice", 0))                            AS cost,
            SUM(CASE WHEN lower(tm.unit) IN ('m', 'meter', 'metre')
                  THEN COALESCE(tm."usedQuantity", CASE WHEN tm.done THEN tm.quantity ELSE 0 END)
                  ELSE 0 END)                                                          AS meters
          FROM "TaskMaterial" tm
          JOIN "WorkOrderTask" wt ON wt.id = tm."taskId"
          JOIN "WorkOrder" wo ON wo.id = wt."workOrderId"
          JOIN "Project" p ON p.id = wo."projectId"
          WHERE p."orgId" = ${user.orgId}
            AND p."deletedAt" IS NULL
            AND tm."createdAt" >= ${salesSince}
            AND tm.rejected = false
            AND (tm."isExtraWork" = false
                 OR (tm."approvedByOffice" = true AND tm."approvedByClient" = true))
        `,
      ]);

      const byStatus = emptyCount(PROJECT_STATUSES);
      const byStage = emptyCount(STAGES);
      let pipelineValue = 0;
      for (const p of projects) {
        byStatus[p.status] += 1;
        byStage[p.stage] += 1;
        pipelineValue += p.value;
      }

      const payload: AdminDashboard = {
        role: "admin",
        kpis: {
          totalProjects: projects.length,
          activeProjects,
          plannedThisWeek,
          readyToInvoice,
          recentActivity,
        },
        byStatus,
        byStage,
        pipelineValue,
        urgentCount,
        blockedCount,
        openInvoices,
        sales: {
          sold: Number(salesRows[0]?.sold ?? 0),
          cost: Number(salesRows[0]?.cost ?? 0),
          profit: Number(salesRows[0]?.sold ?? 0) - Number(salesRows[0]?.cost ?? 0),
          metersLaid: Number(salesRows[0]?.meters ?? 0),
        },
      };
      res.json(payload);
      return;
    }

    // ------------------------------------------------- technician + foreman
    // Same money-free payload for both; the scope differs via projectScopeWhere
    // (technician: only assigned projects; foreman: every org project — his
    // whole job is the org-wide werkbon/planning view).
    if (user.role === "technician" || user.role === "foreman") {
      const where = projectScopeWhere(user);
      const today = todayIso();
      // Werkbon-level scope: for a technician this is "assigned to me". A
      // project can hold several crews' werkbonnen, so every nested workOrders
      // read below is filtered by it — otherwise the open-task count and the
      // project's planned date would silently fold in a COLLEAGUE's werkbonnen
      // on a shared project. (Foreman is org-wide, so this is `{}` for him and
      // the numbers are unchanged.)
      const woScope = visibleWorkOrdersWhere(user);

      // Visible projects with their open work-order tasks. Scheduling now lives on
      // the werkbon, so a project is relevant when it has a werkbon planned today
      // or later, a werkbon with no date yet, or an OVERDUE one still not finished
      // (planned before today and listStatus != "done"). Dropping that last case is
      // exactly what made a technician's overdue werkbon — and its open tasks —
      // vanish from the dashboard the day after it was planned.
      // WorkOrder.listStatus is "open" | "on_the_way" | "urgent" | "done"; only
      // "done" means signed off, so `not: "done"` is the "still open" predicate.
      const relevantWorkOrder: Prisma.WorkOrderWhereInput = {
        AND: [
          woScope,
          {
            OR: [
              { plannedDate: { gte: today } },
              { plannedDate: null },
              { AND: [{ plannedDate: { lt: today } }, { listStatus: { not: "done" } }] },
            ],
          },
        ],
      };

      // canSeePrices is false for both roles, so we never select or return any
      // price/value fields.
      const projects = await prisma.project.findMany({
        where: { AND: [where, { workOrders: { some: relevantWorkOrder } }] },
        select: {
          id: true,
          projectNumber: true,
          customerName: true,
          address: true,
          city: true,
          status: true,
          stage: true,
          nextStepKey: true,
          workOrders: {
            // Same predicate as the project filter: a project surfaces because of
            // its relevant werkbonnen, so its date and open-task count must be
            // built from exactly those — not from finished or out-of-scope ones.
            where: relevantWorkOrder,
            select: {
              id: true,
              plannedDate: true,
              tasks: { where: { done: false }, select: { id: true } },
            },
          },
        },
      });

      const assignedProjectCount = await prisma.project.count({ where });

      let openTaskCount = 0;
      for (const p of projects) {
        openTaskCount += p.workOrders.reduce((sum, w) => sum + w.tasks.length, 0);
      }

      // ONE list of the assigned work, not date buckets.
      //
      // Splitting it into overdue/today/upcoming meant labelling a werkbon that
      // slipped past its date as "late", which points a finger at whoever is
      // reading the screen — and in practice most past-dated werkbonnen are just
      // never-closed ones, not missed appointments. It also created the failure
      // mode where a project with werkbonnen in two buckets fell out of one.
      // A flat list, earliest first, has neither problem.
      const rows = projects
        .map((p) => {
          const open = p.workOrders.reduce((sum, w) => sum + w.tasks.length, 0);
          // The project's date here is its earliest still-relevant werkbon.
          const plannedDate = p.workOrders
            .map((w) => w.plannedDate)
            .filter((d): d is string => d !== null)
            .sort()[0] ?? null;
          // Tapping the row opens the werkbon — but only when there is exactly
          // one to open. With several, picking any of them would be a guess, so
          // the row stays non-interactive rather than sending someone to the
          // wrong visit.
          const workOrderId = p.workOrders.length === 1 ? p.workOrders[0].id : null;
          return technicianProjectRow({ ...p, plannedDate, workOrderId }, open);
        })
        // Earliest-scheduled first; undated work last (it has nothing to sort by,
        // but it is still assigned, so it stays on the list).
        .sort((a, b) => {
          if (a.plannedDate === b.plannedDate) return 0;
          if (a.plannedDate === null) return 1;
          if (b.plannedDate === null) return -1;
          return a.plannedDate < b.plannedDate ? -1 : 1;
        });

      const payload: TechnicianDashboard = {
        role: user.role,
        projects: rows,
        openTaskCount,
        assignedProjectCount,
      };
      // The technician dashboard never carries money fields (technicianProjectRow
      // omits project value/prices entirely), so there is nothing to strip here
      // regardless of the org's hide-prices setting.
      res.json(payload);
      return;
    }

    // ---------------------------------------------------------------- client
    const where = projectScopeWhere(user); // only their customer's projects
    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ status: "asc" }],
      select: {
        id: true,
        projectNumber: true,
        status: true,
        stage: true,
        nextStepKey: true,
        // Scheduling lives on the werkbon; the project's date is its earliest one.
        workOrders: { select: { plannedDate: true } },
      },
    });

    const byStatus = emptyCount(PROJECT_STATUSES);
    for (const p of projects) byStatus[p.status] += 1;

    const rows = projects
      .map((p) => {
        const plannedDate = p.workOrders
          .map((w) => w.plannedDate)
          .filter((d): d is string => d !== null)
          .sort()[0] ?? null;
        return clientProjectRow({ ...p, plannedDate });
      })
      // Group by status, then earliest-scheduled first within a group (unplanned last).
      .sort((a, b) => {
        if (a.status !== b.status) return a.status < b.status ? -1 : 1;
        if (a.plannedDate === b.plannedDate) return 0;
        if (a.plannedDate === null) return 1;
        if (b.plannedDate === null) return -1;
        return a.plannedDate < b.plannedDate ? -1 : 1;
      });

    const payload: ClientDashboard = {
      role: "client",
      projects: rows,
      byStatus,
    };
    res.json(payload);
  }),
);
