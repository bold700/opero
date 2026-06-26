import { Router } from "express";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { Forbidden } from "../../lib/httpError.js";
import { requireAuth } from "../../auth/middleware.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// GET /reports — aggregate figures for the reports dashboard. Admin only
// (technicians see only their own timesheet via /employees/:id/timesheet).
reportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role !== "admin") throw Forbidden("Not available");
    const orgWhere = { orgId: user.orgId, deletedAt: null };

    const [workOrderCount, projects, tasks, invoices, recentProjects, employees] =
      await Promise.all([
        prisma.workOrder.count({ where: { project: { is: orgWhere } } }),
        prisma.project.findMany({ where: orgWhere, select: { value: true } }),
        prisma.workOrderTask.findMany({
          where: { workOrder: { project: { is: orgWhere } } },
          select: { hours: true },
        }),
        prisma.invoice.findMany({
          where: { project: { is: orgWhere } },
          select: { materialsAmount: true },
        }),
        prisma.project.findMany({
          where: orgWhere,
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, projectNumber: true, createdAt: true },
        }),
        prisma.employee.findMany({
          where: { orgId: user.orgId, deletedAt: null },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                projectsAsLeader: true,
                projectsAsTeamLeader: true,
                projectsAsInstaller: true,
              },
            },
          },
        }),
      ]);

    const totalHours = tasks.reduce((sum, t) => sum + (t.hours ?? 0), 0);
    const revenue = projects.reduce((sum, p) => sum + p.value, 0);
    const materialCosts = invoices.reduce((sum, i) => sum + i.materialsAmount, 0);

    // Work orders per ISO week for the last 5 weeks.
    const chart = await workOrdersPerWeek(orgWhere);

    const topEmployees = employees
      .map((e) => ({
        id: e.id,
        name: e.name,
        workOrderCount:
          e._count.projectsAsLeader +
          e._count.projectsAsTeamLeader +
          e._count.projectsAsInstaller,
      }))
      .filter((e) => e.workOrderCount > 0)
      .sort((a, b) => b.workOrderCount - a.workOrderCount)
      .slice(0, 5);

    res.json({
      kpis: {
        workOrders: workOrderCount,
        hours: Math.round(totalHours),
        revenue,
        materialCosts,
      },
      chart,
      recentReports: recentProjects.map((p) => ({
        id: p.projectNumber,
        date: p.createdAt.toISOString(),
      })),
      topEmployees,
    });
  }),
);

async function workOrdersPerWeek(orgWhere: { orgId: string; deletedAt: null }) {
  const now = new Date();
  const weeks: { week: string; from: Date; to: Date }[] = [];
  for (let i = 4; i >= 0; i--) {
    const to = new Date(now);
    to.setDate(now.getDate() - i * 7);
    const from = new Date(to);
    from.setDate(to.getDate() - 6);
    weeks.push({ week: `W${isoWeek(to)}`, from, to });
  }
  const counts = await Promise.all(
    weeks.map((w) =>
      prisma.workOrder.count({
        where: {
          project: { is: orgWhere },
          createdAt: { gte: w.from, lte: w.to },
        },
      }),
    ),
  );
  return weeks.map((w, i) => ({ week: w.week, value: counts[i] }));
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
