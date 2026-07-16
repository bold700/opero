import { Router } from "express";
import type { ProjectStatus, Stage } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../auth/middleware.js";
import { projectScopeWhere } from "../projects/visibility.js";
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

function emptyCount<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

// GET /dashboard — role-aware payload.
dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // ---------------------------------------------------------------- admin
    if (user.role === "admin") {
      const where = projectScopeWhere(user); // all org projects
      const { start, end } = isoWeekRange();

      const [
        projects,
        plannedThisWeek,
        urgentCount,
        blockedCount,
        openInvoices,
        recentActivity,
        readyToInvoice,
        activeProjects,
      ] = await Promise.all([
        prisma.project.findMany({
          where,
          select: { status: true, stage: true, value: true },
        }),
        prisma.project.count({
          where: { ...where, workOrders: { some: { plannedDate: { gte: start, lte: end } } } },
        }),
        prisma.project.count({ where: { ...where, urgency: "urgent" } }),
        prisma.project.count({ where: { ...where, urgency: "blocked" } }),
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
      };
      res.json(payload);
      return;
    }

    // ----------------------------------------------------------- technician
    if (user.role === "technician") {
      const where = projectScopeWhere(user); // only assigned projects
      const today = todayIso();

      // Assigned projects with their open work-order tasks. Scheduling now lives on
      // the werkbon, so a project is "upcoming" when it has a werkbon planned today
      // or later, or a werkbon with no date yet. canSeePrices(technician) is false,
      // so we never select or return any price/value fields.
      const projects = await prisma.project.findMany({
        where: {
          ...where,
          OR: [
            { workOrders: { some: { plannedDate: { gte: today } } } },
            { workOrders: { some: { plannedDate: null } } },
          ],
        },
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
            select: {
              plannedDate: true,
              tasks: { where: { done: false }, select: { id: true } },
            },
          },
        },
      });

      const assignedProjectCount = await prisma.project.count({ where });

      let openTaskCount = 0;
      const rows = projects.map((p) => {
        const open = p.workOrders.reduce((sum, w) => sum + w.tasks.length, 0);
        openTaskCount += open;
        // The project's "date" is the earliest scheduled werkbon (null if none set).
        const plannedDate = p.workOrders
          .map((w) => w.plannedDate)
          .filter((d): d is string => d !== null)
          .sort()[0] ?? null;
        return technicianProjectRow({ ...p, plannedDate }, open);
      });
      // Earliest-scheduled-first, unplanned projects last.
      rows.sort((a, b) => {
        if (a.plannedDate === b.plannedDate) return 0;
        if (a.plannedDate === null) return 1;
        if (b.plannedDate === null) return -1;
        return a.plannedDate < b.plannedDate ? -1 : 1;
      });

      const payload: TechnicianDashboard = {
        role: "technician",
        todayProjects: rows.filter((r) => r.plannedDate === today),
        upcomingProjects: rows.filter((r) => r.plannedDate !== null && r.plannedDate > today),
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
