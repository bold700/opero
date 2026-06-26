import { Router } from "express";
import type { ProjectStatus, Stage } from "@prisma/client";
import { canSeePrices } from "@opero/shared";
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
          where: { ...where, plannedDate: { gte: start, lte: end } },
        }),
        prisma.project.count({ where: { ...where, urgency: "urgent" } }),
        prisma.project.count({ where: { ...where, urgency: "blocked" } }),
        // unpaid/overdue: invoice sent or not yet paid (anything not "paid").
        prisma.project.count({
          where: { ...where, invoice: { is: { status: { in: ["draft", "sent"] } } } },
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
            invoice: { is: { status: { in: ["not_started", "draft"] } } },
          },
        }),
        prisma.project.count({
          where: {
            ...where,
            OR: [{ invoice: { is: { status: { not: "paid" } } } }, { invoice: { is: null } }],
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

      // Assigned projects with their open work-order tasks. canSeePrices(technician)
      // is false, so we never select or return any price/value fields.
      const projects = await prisma.project.findMany({
        where: {
          ...where,
          OR: [{ plannedDate: { gte: today } }, { plannedDate: null }],
        },
        orderBy: { plannedDate: "asc" },
        select: {
          id: true,
          projectNumber: true,
          customerName: true,
          address: true,
          city: true,
          status: true,
          stage: true,
          plannedDate: true,
          nextStepKey: true,
          workOrders: {
            select: { tasks: { where: { done: false }, select: { id: true } } },
          },
        },
      });

      const assignedProjectCount = await prisma.project.count({ where });

      let openTaskCount = 0;
      const rows = projects.map((p) => {
        const open = p.workOrders.reduce((sum, w) => sum + w.tasks.length, 0);
        openTaskCount += open;
        return technicianProjectRow(p, open);
      });

      const payload: TechnicianDashboard = {
        role: "technician",
        todayProjects: rows.filter((r) => r.plannedDate === today),
        upcomingProjects: rows.filter((r) => r.plannedDate !== null && r.plannedDate > today),
        openTaskCount,
        assignedProjectCount,
      };
      // Defensive: technicians may never receive prices.
      void canSeePrices(user.role);
      res.json(payload);
      return;
    }

    // ---------------------------------------------------------------- client
    const where = projectScopeWhere(user); // only their customer's projects
    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ status: "asc" }, { plannedDate: "asc" }],
      select: {
        id: true,
        projectNumber: true,
        status: true,
        stage: true,
        plannedDate: true,
        nextStepKey: true,
      },
    });

    const byStatus = emptyCount(PROJECT_STATUSES);
    for (const p of projects) byStatus[p.status] += 1;

    const payload: ClientDashboard = {
      role: "client",
      projects: projects.map(clientProjectRow),
      byStatus,
    };
    res.json(payload);
  }),
);
