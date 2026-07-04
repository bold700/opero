import { Router } from "express";
import type { Prisma, TeamRole } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  toggleRoleSchema,
} from "./schema.js";
import { employeeDto, employeeListDto, employeeListInclude } from "./dto.js";

export const employeesRouter = Router();

// All employee routes require auth.
employeesRouter.use(requireAuth);

// The office roles: an employee is "office" if any of their roles intersects
// this set (mirrors the client's OFFICE_ROLES). Technicians = roles include
// "Technician". Roles are stored as a TeamRole[] scalar enum array on Employee,
// so array filters use `has` / `hasSome`.
const OFFICE_ROLES: TeamRole[] = ["Administration", "Sales", "WorkPlanner", "Planner"];

// The filter chips shown on the list (English, stable values).
const EMPLOYEE_FILTERS = ["technicians", "office", "inactive"] as const;
type EmployeeFilter = (typeof EMPLOYEE_FILTERS)[number];

// Translate a filter chip to a Prisma where-fragment, ANDed onto baseWhere.
function employeeFilterWhere(filter: EmployeeFilter): Prisma.EmployeeWhereInput {
  switch (filter) {
    case "technicians":
      return { roles: { has: "Technician" } };
    case "office":
      return { roles: { hasSome: OFFICE_ROLES } };
    case "inactive":
      return { status: "inactive" };
  }
}

// GET /employees?cursor=&limit=&search=&filter= — admin only (per spec matrix,
// Employees is admin-only; technician + client: 403). Cursor-paginated,
// server-searched (name/email/phone) and server-filtered by chip. Returns
// { items, nextCursor, counts } where counts covers the KPI/chip buckets across
// the WHOLE (org-scoped, searched) set so the pills stay accurate across pages.
employeesRouter.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { limit, cursor, search } = parsePageParams(req);
    const filter =
      typeof req.query.filter === "string" &&
      (EMPLOYEE_FILTERS as readonly string[]).includes(req.query.filter)
        ? (req.query.filter as EmployeeFilter)
        : undefined;

    // Base org-scoped filter (shared by counts + the page query). Search matches
    // name / email / phone, case-insensitive.
    const baseWhere: Prisma.EmployeeWhereInput = {
      orgId: user.orgId,
      deletedAt: null,
    };
    if (search) {
      const ci = { contains: search, mode: "insensitive" as const };
      baseWhere.OR = [{ name: ci }, { email: ci }, { phone: ci }];
    }

    // Counts across the whole scoped+searched set (not just the page). Status
    // buckets come from a groupBy; the role-based buckets (technicians/office)
    // are separate counts since they filter the roles array, not status.
    const [grouped, technicians, office] = await Promise.all([
      prisma.employee.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.employee.count({
        where: { AND: [baseWhere, employeeFilterWhere("technicians")] },
      }),
      prisma.employee.count({
        where: { AND: [baseWhere, employeeFilterWhere("office")] },
      }),
    ]);
    const counts: Record<string, number> = {
      total: 0,
      active: 0,
      on_leave: 0,
      inactive: 0,
      technicians,
      office,
    };
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      counts.total += g._count._all;
    }

    // The page itself: apply the chip filter on top of the base filter.
    const pageWhere: Prisma.EmployeeWhereInput = filter
      ? { AND: [baseWhere, employeeFilterWhere(filter)] }
      : baseWhere;

    const page = await paginate({ limit, cursor, search }, (args) =>
      prisma.employee.findMany({
        where: pageWhere,
        include: employeeListInclude,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        ...args,
      }),
    );

    res.json({
      items: page.items.map(employeeListDto),
      nextCursor: page.nextCursor,
      counts,
    });
  }),
);

// GET /employees/:id — admin only.
employeesRouter.get(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const row = await prisma.employee.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
      include: { users: { select: { id: true, status: true } } },
    });
    if (!row) throw NotFound("Employee not found");
    res.json(employeeDto(row));
  }),
);

// POST /employees — admin only. Mirrors store addTeamMember.
employeesRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createEmployeeSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const e = await tx.employee.create({
        data: {
          orgId: user.orgId,
          name: clampText(input.name),
          phone: clampText(input.phone),
          email: input.email ? clampText(input.email) : null,
          roles: (input.roles ?? []) as TeamRole[],
          status: input.status ?? "active",
        },
      });
      await audit(tx, user, "employee.create", "employee", e.id, { name: e.name });
      return e;
    });
    res.status(201).json(employeeDto(created));
  }),
);

// PATCH /employees/:id — admin only. Mirrors store updateTeamMember.
employeesRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateEmployeeSchema.parse(req.body);
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Employee not found");
    const updated = await prisma.$transaction(async (tx) => {
      const e = await tx.employee.update({
        where: { id: existing.id },
        data: {
          name: input.name !== undefined ? clampText(input.name) : undefined,
          phone: input.phone !== undefined ? clampText(input.phone) : undefined,
          email: input.email !== undefined ? clampText(input.email) : undefined,
          roles:
            input.roles !== undefined ? (input.roles as TeamRole[]) : undefined,
          status: input.status !== undefined ? input.status : undefined,
        },
      });
      await audit(tx, user, "employee.update", "employee", e.id, input);
      return e;
    });
    res.json(employeeDto(updated));
  }),
);

// POST /employees/:id/roles — admin only. Toggle a single role on/off.
// Mirrors store toggleTeamMemberRole: if present remove, else add.
employeesRouter.post(
  "/:id/roles",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = toggleRoleSchema.parse(req.body);
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Employee not found");
    const role = input.role as TeamRole;
    const nextRoles = existing.roles.includes(role)
      ? existing.roles.filter((r) => r !== role)
      : [...existing.roles, role];
    const updated = await prisma.$transaction(async (tx) => {
      const e = await tx.employee.update({
        where: { id: existing.id },
        data: { roles: nextRoles },
      });
      await audit(tx, user, "employee.toggleRole", "employee", e.id, {
        role,
        roles: nextRoles,
      });
      return e;
    });
    res.json(employeeDto(updated));
  }),
);

// DELETE /employees/:id — admin only, soft delete. Mirrors store removeTeamMember.
employeesRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw NotFound("Employee not found");
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await audit(tx, user, "employee.delete", "employee", existing.id);
    });
    res.status(204).end();
  }),
);

// GET /employees/:id/timesheet?from=&to= — aggregate WorkOrderTask.hours.
//
// The schema has no direct WorkOrderTask -> Employee FK. Hours are logged per task
// on workOrders of projects the employee is assigned to. For the MVP timesheet we
// sum WorkOrderTask.hours across workOrders of projects where this employee is the
// projectLeader OR teamLeader OR one of the installers, optionally filtered by the
// task's `day` string (YYYY-MM-DD) with a lexicographic >= from && <= to filter.
//
// Guard: admin may view any employee's timesheet; a technician may view ONLY their
// own (user.employeeId === :id). Client: 403.
employeesRouter.get(
  "/:id/timesheet",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const employeeId = req.params.id;
    const canView =
      user.role === "admin" ||
      (user.role === "technician" && user.employeeId === employeeId);
    if (!canView) throw Forbidden("Not allowed for this timesheet");

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, orgId: user.orgId, deletedAt: null },
    });
    if (!employee) throw NotFound("Employee not found");

    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    // Projects this employee is assigned to (as leader, team leader, or installer).
    const projects = await prisma.project.findMany({
      where: {
        orgId: user.orgId,
        deletedAt: null,
        OR: [
          { projectLeaderId: employeeId },
          { teamLeaderId: employeeId },
          { installers: { some: { id: employeeId } } },
        ],
      },
      select: {
        id: true,
        projectNumber: true,
        workOrders: {
          select: {
            tasks: {
              select: { day: true, hours: true },
            },
          },
        },
      },
    });

    const entries: {
      projectId: string;
      projectNumber: string;
      day: string | null;
      hours: number;
    }[] = [];
    let totalHours = 0;

    for (const project of projects) {
      for (const workOrder of project.workOrders) {
        for (const task of workOrder.tasks) {
          if (task.hours == null) continue;
          // Filter by day range only when bounds are provided.
          if (from !== undefined && (task.day == null || task.day < from)) continue;
          if (to !== undefined && (task.day == null || task.day > to)) continue;
          entries.push({
            projectId: project.id,
            projectNumber: project.projectNumber,
            day: task.day,
            hours: task.hours,
          });
          totalHours += task.hours;
        }
      }
    }

    res.json({ employeeId, totalHours, entries });
  }),
);
