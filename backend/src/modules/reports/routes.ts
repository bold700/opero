import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { Forbidden } from "../../lib/httpError.js";
import { requireAuth } from "../../auth/middleware.js";
import { isOffice, type UserRole } from "@opero/shared";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// Reports is office work (company-wide finance/analytics) — the owner and
// office staff. Field staff (technician, foreman) see only their own timesheet
// via /employees/:id/timesheet; clients see nothing. isOffice, NOT
// canSeeAllProjects: the foreman sees every project but never company finance.
//
// Named requireStaff, not requireAdmin: a helper called "requireAdmin" that
// also admits office would be a landmine for the next reader.
function requireStaff(role: UserRole) {
  if (!isOffice(role)) throw Forbidden("Not available");
}

// --- Period handling ------------------------------------------------------
// The client sends ?from=YYYY-MM-DD&to=YYYY-MM-DD. Default: the current month.
// Dates that live as DateTime (WorkOrder.createdAt) filter with Date bounds;
// dates stored as ISO strings (Invoice.paidDate) filter lexically (ISO sorts).
const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolvePeriod(q: { from?: string; to?: string }): { from: string; to: string } {
  if (q.from && q.to) return { from: q.from, to: q.to };
  // default: current month (server clock)
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  return { from: iso(first), to: iso(last) };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
// Inclusive end-of-day for DateTime comparisons.
const endOfDay = (isoDate: string) => new Date(`${isoDate}T23:59:59.999Z`);
const startOfDay = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

// GET /reports?from&to — period-scoped company analytics.
reportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    requireStaff(user.role);
    const { from, to } = resolvePeriod(periodSchema.parse(req.query));
    const orgWhere = { orgId: user.orgId, deletedAt: null };

    // Work orders created in the period.
    const woInPeriod = {
      project: { is: orgWhere },
      createdAt: { gte: startOfDay(from), lte: endOfDay(to) },
    };

    const [workOrderCount, tasks, paidInvoices, recentWorkOrders, taskAssignments] =
      await Promise.all([
        // KPI: work orders created in period
        prisma.workOrder.count({ where: woInPeriod }),
        // KPI: hours logged on tasks of in-period work orders
        prisma.workOrderTask.findMany({
          where: { workOrder: { is: woInPeriod } },
          select: { hours: true },
        }),
        // KPI: revenue + material costs = invoices PAID in the period.
        // (paidDate is an ISO string; lexical range works.)
        prisma.invoice.findMany({
          where: {
            workOrder: { is: { project: { is: orgWhere } } },
            paidDate: { gte: from, lte: to },
          },
          select: {
            acceptedQuoteAmount: true,
            extraWorkAmount: true,
            materialsAmount: true,
            laborAmount: true,
          },
        }),
        // Recent work orders in period (real, linkable) — replaces the old fake list.
        prisma.workOrder.findMany({
          where: woInPeriod,
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            title: true,
            ordinal: true,
            createdAt: true,
            signedAt: true,
            project: { select: { projectNumber: true, customerName: true } },
          },
        }),
        // Top technicians: count work orders they're assigned to (via task
        // assignee) IN the period. Distinct work orders per employee.
        prisma.workOrderTask.findMany({
          where: { workOrder: { is: woInPeriod }, assigneeId: { not: null } },
          select: { assigneeId: true, workOrderId: true, hours: true, assignee: { select: { name: true } } },
        }),
      ]);

    const totalHours = tasks.reduce((sum, t) => sum + (t.hours ?? 0), 0);
    // "Omzet" = total invoiced amount on invoices paid this period. (Change this
    // one line if the client redefines revenue.)
    const revenue = paidInvoices.reduce(
      (sum, i) => sum + i.acceptedQuoteAmount + i.extraWorkAmount + i.materialsAmount + i.laborAmount,
      0,
    );
    const materialCosts = paidInvoices.reduce((sum, i) => sum + i.materialsAmount, 0);

    // Buckets: weeks if the range is short (<= ~92 days), else months.
    const chart = await bucketedWorkOrders(orgWhere, from, to);

    // Aggregate top technicians from the task rows (distinct work orders + hours).
    const byEmployee = new Map<string, { name: string; workOrders: Set<string>; hours: number }>();
    for (const t of taskAssignments) {
      if (!t.assigneeId) continue;
      const e = byEmployee.get(t.assigneeId) ?? {
        name: t.assignee?.name ?? "—",
        workOrders: new Set<string>(),
        hours: 0,
      };
      e.workOrders.add(t.workOrderId);
      e.hours += t.hours ?? 0;
      byEmployee.set(t.assigneeId, e);
    }
    const topEmployees = [...byEmployee.entries()]
      .map(([id, e]) => ({ id, name: e.name, workOrderCount: e.workOrders.size, hours: Math.round(e.hours) }))
      .sort((a, b) => b.workOrderCount - a.workOrderCount || b.hours - a.hours)
      .slice(0, 5);

    res.json({
      period: { from, to },
      kpis: {
        workOrders: workOrderCount,
        hours: Math.round(totalHours),
        revenue,
        materialCosts,
      },
      chart,
      recentWorkOrders: recentWorkOrders.map((w) => ({
        id: w.id,
        label: w.title || `#${w.ordinal + 1} · ${w.project.projectNumber}`,
        customer: w.project.customerName,
        date: w.createdAt.toISOString(),
        signed: Boolean(w.signedAt),
      })),
      topEmployees,
    });
  }),
);

// Bucket work-order counts across the period: by ISO week when the range spans
// <= ~13 weeks, otherwise by calendar month.
async function bucketedWorkOrders(
  orgWhere: { orgId: string; deletedAt: null },
  from: string,
  to: string,
) {
  const start = startOfDay(from);
  const end = endOfDay(to);
  const days = (end.getTime() - start.getTime()) / 86400000;

  const buckets: { label: string; from: Date; to: Date }[] = [];
  if (days <= 92) {
    // weekly buckets
    let cur = new Date(start);
    while (cur <= end) {
      const bEnd = new Date(cur);
      bEnd.setUTCDate(bEnd.getUTCDate() + 6);
      buckets.push({
        label: `W${isoWeek(cur)}`,
        from: new Date(cur),
        to: bEnd > end ? end : bEnd,
      });
      cur = new Date(bEnd);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else {
    // monthly buckets
    let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cur <= end) {
      const bEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      buckets.push({
        label: cur.toLocaleString("en", { month: "short" }),
        from: new Date(cur),
        to: bEnd > end ? end : bEnd,
      });
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
  }

  const counts = await Promise.all(
    buckets.map((b) =>
      prisma.workOrder.count({
        where: { project: { is: orgWhere }, createdAt: { gte: b.from, lte: b.to } },
      }),
    ),
  );
  return buckets.map((b, i) => ({ week: b.label, value: counts[i] }));
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
