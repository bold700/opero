import { Router } from "express";
import type { Prisma, TeamRole } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  toggleRoleSchema,
  createAbsenceSchema,
  updateAbsenceSchema,
} from "./schema.js";
import {
  employeeDto,
  employeeListDto,
  employeeListInclude,
  absenceDto,
} from "./dto.js";
import { autoInviteEmployee } from "../users/provisioning.js";
import { absencesInRange, isIsoDay, todayIso } from "./absence.js";

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

// --- Absences (vacation / sick / training) ---------------------------------
//
// Dated unavailability per employee, so planning stops offering someone who is
// away ("allow vacation and absence periods to be scheduled per employee, so
// employees are automatically not scheduled or invoiced" — WOB Isolatie).
//
// These MUST precede "/:id", or Express matches "absences" as an employee id.

// GET /employees/absences?from=&to=&employeeId= — admin only. Without a range,
// returns everything from today onward (the useful default for planning).
employeesRouter.get(
  "/absences",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const from = isIsoDay(req.query.from) ? req.query.from : todayIso();
    // Open-ended by default: a far-future bound keeps the query shape uniform
    // without needing a separate "no upper bound" branch.
    const to = isIsoDay(req.query.to) ? req.query.to : "9999-12-31";
    const employeeId =
      typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;

    const rows = await absencesInRange(
      user.orgId,
      from,
      to,
      employeeId ? [employeeId] : undefined,
    );
    res.json(rows.map(absenceDto));
  }),
);

// POST /employees/absences — admin only.
employeesRouter.post(
  "/absences",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createAbsenceSchema.parse(req.body);

    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, orgId: user.orgId, deletedAt: null },
    });
    if (!employee) throw NotFound("Employee not found");

    const created = await prisma.$transaction(async (tx) => {
      const a = await tx.employeeAbsence.create({
        data: {
          orgId: user.orgId,
          employeeId: input.employeeId,
          kind: input.kind ?? "vacation",
          startDate: input.startDate,
          endDate: input.endDate,
          note: input.note ? clampText(input.note) : null,
        },
        include: { employee: { select: { id: true, name: true } } },
      });
      await audit(tx, user, "employee.absence.create", "employeeAbsence", a.id, {
        employeeId: input.employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      return a;
    });
    res.status(201).json(absenceDto(created));
  }),
);

// PATCH /employees/absences/:absenceId — admin only.
employeesRouter.patch(
  "/absences/:absenceId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateAbsenceSchema.parse(req.body);
    const existing = await prisma.employeeAbsence.findFirst({
      where: { id: req.params.absenceId, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Absence not found");

    // Re-check the ordering against the MERGED range: a patch that moves only
    // one end can still invert the period.
    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    if (startDate > endDate) throw BadRequest("endDate must not be before startDate");

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.employeeAbsence.update({
        where: { id: existing.id },
        data: {
          kind: input.kind ?? undefined,
          startDate,
          endDate,
          note:
            input.note !== undefined
              ? input.note === null
                ? null
                : clampText(input.note)
              : undefined,
        },
        include: { employee: { select: { id: true, name: true } } },
      });
      await audit(tx, user, "employee.absence.update", "employeeAbsence", a.id, input);
      return a;
    });
    res.json(absenceDto(updated));
  }),
);

// DELETE /employees/absences/:absenceId — admin only. Hard delete: an absence
// that was entered by mistake should leave no trace on the planning view.
employeesRouter.delete(
  "/absences/:absenceId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.employeeAbsence.findFirst({
      where: { id: req.params.absenceId, orgId: user.orgId },
    });
    if (!existing) throw NotFound("Absence not found");
    await prisma.$transaction(async (tx) => {
      await tx.employeeAbsence.delete({ where: { id: existing.id } });
      await audit(tx, user, "employee.absence.delete", "employeeAbsence", existing.id);
    });
    res.status(204).end();
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

    // Auto-provision a login: "when an employee is created, an account should
    // automatically be created for them" (WOB Isolatie, 17-07-2026). Only
    // possible with an email address, and deliberately BEST-EFFORT — the
    // employee record must not fail to save because the address is already
    // taken or the mail provider is down. The outcome ships in the response so
    // the UI can say what happened; the manual Invite action remains the retry.
    //
    // ALWAYS the technician role, never admin — even for office job titles.
    // TeamRole is a job description ("Planner"), not an access level, and
    // silently minting an admin login from one would be privilege escalation by
    // typo. An admin promotes the account afterwards from the Access screen.
    const invite = await autoInviteEmployee(user, created, "technician");

    res.status(201).json({ ...employeeDto(created), invite });
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

    // "…so employees are automatically not scheduled OR INVOICED" (WOB
    // Isolatie, 17-07-2026). Hours are only ever logged against a task, so an
    // absent day normally contributes nothing and drops out on its own — the
    // invoicing half needs no subtraction.
    //
    // What it DOES need is a check that the two never contradict each other.
    // Hours logged on a day the employee was recorded absent means one of the
    // two is wrong (someone worked and the holiday wasn't cancelled, or the
    // hours went onto the wrong person). Silently billing them is the bad
    // outcome, so those entries are flagged and reported separately instead of
    // being quietly folded into the total.
    const absences = await absencesInRange(
      user.orgId,
      from ?? "0000-01-01",
      to ?? "9999-12-31",
      [employeeId],
    );
    const isAbsentOn = (day: string | null) =>
      day != null && absences.some((a) => a.startDate <= day && day <= a.endDate);

    const conflicting = entries.filter((e) => isAbsentOn(e.day));
    const absentHours = conflicting.reduce((sum, e) => sum + e.hours, 0);

    res.json({
      employeeId,
      totalHours,
      entries,
      // Days the employee was recorded absent, for the timesheet to show as
      // non-working rows rather than gaps.
      absences: absences.map((a) => ({
        id: a.id,
        kind: a.kind,
        startDate: a.startDate,
        endDate: a.endDate,
      })),
      // Non-zero means the timesheet and the absence calendar disagree.
      absentHours,
      conflictingEntries: conflicting,
    });
  }),
);
