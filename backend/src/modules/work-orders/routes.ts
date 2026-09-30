import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  type UserRole,
  canDispatch,
  canSeeAllProjects,
  canEditQuoteScope,
  canApproveAsOffice,
  isStaff,
  addWorkOrderPrejobItemSchema,
  updateWorkOrderPrejobItemSchema,
  reorderPrejobItemsSchema,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { storeUpload, storeAttachment, deleteStored, storeSignature } from "../../lib/attachUpload.js";
import { uploadSingle } from "../../lib/upload.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import type { AuthUser } from "../../auth/types.js";
import {
  canViewWorkOrder,
  visibleWorkOrdersWhere,
  workOrderScopeWhere,
} from "./visibility.js";
import {
  workOrderDto,
  workOrderInclude,
  workOrderListDto,
  workOrderListInclude,
  type WorkOrderWithRelations,
} from "./dto.js";
import { recomputeWorkOrderStatus } from "./status.js";
import { workOrderStatusIds } from "@opero/shared";
import {
  applyWorkOrderSchedule,
  clearWorkOrderSchedule,
  setWorkOrderEndDate,
  DEFAULT_START_TIME,
  DEFAULT_END_TIME,
} from "../planning/schedule.js";
import { absencesInRange, isIsoDay } from "../employees/absence.js";
import {
  assignableRoleFilterSchema,
  assignableWhere,
} from "../employees/assignable-roles.js";
import { buildWorkOrderPdf, type WorkOrderPdfData } from "./pdf.js";
import { buildQuotePdf, type QuotePdfData } from "./quote-pdf.js";
import { buildMaterialLineName, parseDiameter, LINE_UNIT_LABELS } from "../materials/labels.js";
import {
  addMaterialFromCatalogSchema,
  addMaterialFromArticleSchema,
  addMaterialSchema,
  createWorkOrderSchema,
  rejectMeerwerkSchema,
  removePhotoSchema,
  reorderTasksSchema,
  setWorkOrderStatusSchema,
  taskHoursSchema,
  updateMaterialSchema,
  updateTaskSchema,
  updateWorkOrderSchema,
  usageSchema,
  progressSchema,
  addWorkOrderRequirementSchema,
  updateWorkOrderRequirementSchema,
} from "./schema.js";
export const workOrdersRouter = Router();

type Tx = Prisma.TransactionClient;

// The project shape we need for visibility + write-gating.
type ProjectForGuard = {
  id: string;
  orgId: string;
  customerId: string;
  teamLeaderId: string | null;
  projectLeaderId: string | null;
  installers: { id: string }[];
};

workOrdersRouter.use(requireAuth);

// =========================================================================
// Helpers
// =========================================================================

// Append a ProjectActivity "system" row inside a transaction. Stores a
// language-neutral messageKey + structured params (English internals); the
// client renders it via i18n. No display prose is stored.
async function appendActivity(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  messageKey: string,
  params?: Record<string, unknown>,
): Promise<void> {
  await tx.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      type: "system",
      messageKey,
      params: (params ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

// Round milliseconds to hours in 0.25 steps (ported from the store's
// endTask: Math.round(ms / 3_600_000 * 4) / 4).
function msToHours(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 4) / 4;
}

// Recompute project.value (offertebedrag) = sum over all workOrders tasks
// materials of quantity * unitPrice (ported from the quote-amount calc).
// Mirrors the store: a zero sum keeps the existing value untouched.
// Billing is per-WERKBON: sum only THIS werkbon's task materials into its own
// `value`, and keep its Quote amount in sync. Each werkbon is quoted/invoiced
// on its own (the project is just a grouping of werkbonnen).
async function recomputeQuoteAmount(tx: Tx, workOrderId: string): Promise<void> {
  // SOLD SCOPE ONLY. Meerwerk (isExtraWork) is deliberately excluded: it isn't
  // part of what the customer bought, and it only becomes billable once both
  // office and client approve it — at which point it lands in the invoice's
  // separate extraWorkAmount bucket (see deriveTotals in invoices/routes.ts).
  // Counting it here too would bill it twice.
  const materials = await tx.taskMaterial.findMany({
    where: { task: { workOrderId }, isExtraWork: false },
    select: { quantity: true, unitPrice: true },
  });
  const value = materials.reduce(
    (sum, m) => sum + m.quantity * (m.unitPrice ?? 0),
    0,
  );
  await tx.workOrder.update({ where: { id: workOrderId }, data: { value } });
  // Keep the draft quote's amount aligned with the werkbon value when one exists.
  await tx.quote.updateMany({ where: { workOrderId }, data: { amount: value } });
}

// Load a workOrder + its project, enforce visibility, return write-ability.
//
// VISIBILITY / GUARD MODEL — assignment is per WERKBON, not per project:
// - admin/office/foreman: canView always; canWrite always.
// - technician: canView/canWrite ONLY for werkbonnen they are assigned to
//               (WorkOrder.assignees, or holding one of its zones). Being on
//               the parent project's crew is NOT enough — a project holds many
//               visits and other crews' werkbonnen must stay hidden.
// - client:     canView only for their own customer's werkbonnen; canWrite never.
// Not visible → 404 (don't leak existence).
async function loadProjectForWorkOrder(
  user: AuthUser,
  workOrderId: string,
): Promise<{
  workOrder: { id: string; projectId: string };
  project: ProjectForGuard;
  canWrite: boolean;
  /** True when the ONLY thing between this technician and writing is that the
   *  office hasn't dispatched the werkbon yet — so the 403 can say so. */
  dispatchBlocked: boolean;
}> {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, project: { orgId: user.orgId, deletedAt: null } },
    select: {
      id: true,
      projectId: true,
      dispatchedAt: true,
      assignees: { select: { id: true } },
      tasks: { select: { assigneeId: true } },
      project: {
        select: {
          id: true,
          orgId: true,
          customerId: true,
          teamLeaderId: true,
          projectLeaderId: true,
          installers: { select: { id: true } },
        },
      },
    },
  });
  if (!workOrder || !canViewWorkOrder(user, workOrder)) {
    throw NotFound("Work order not found");
  }
  // Dispatch is the office's release: a technician may VIEW an assigned
  // werkbon before it is dispatched (planning transparency), but not write to
  // it — the Controle vooraf checklist gates dispatch, and dispatch gates
  // field work. Office/admin (and foreman, via canSeeAllProjects) own or lead
  // that flow, so the gate applies to technician-level logins only.
  const assignedTechnician =
    user.role === "technician" && canViewWorkOrder(user, workOrder);
  const dispatchBlocked = assignedTechnician && workOrder.dispatchedAt === null;
  const canWrite =
    canSeeAllProjects(user.role) || (assignedTechnician && !dispatchBlocked);
  return {
    workOrder: { id: workOrder.id, projectId: workOrder.projectId },
    project: workOrder.project,
    canWrite,
    dispatchBlocked,
  };
}

// Guard for any write op: load + assert canWrite, else 403. The undispatched
// case gets its own message so the client can tell "not yours" from "not yet
// released by the office".
async function requireWritableWorkOrder(user: AuthUser, workOrderId: string) {
  const loaded = await loadProjectForWorkOrder(user, workOrderId);
  if (loaded.dispatchBlocked) {
    throw Forbidden("Work order has not been dispatched yet");
  }
  if (!loaded.canWrite) throw Forbidden("Not allowed to modify this work order");
  return loaded;
}

// Guard for editing the QUOTED SCOPE (what was sold), as opposed to registering
// what happened on site.
//
// A technician may register: usage, on-site/done flags, notes, photos, and
// meerwerk (extra work) — see the /extra-work routes. They may NOT rewrite or
// delete the work that came off the quotation, because every one of those
// fields feeds recomputeQuoteAmount() and therefore moves the amount invoiced
// to the customer. Scope is office work; the monteur's channel for "this job
// needed more than we sold" is meerwerk, which the office then approves.
//
// Assignment is still required — being office is not enough on its own, the
// work order must also be writable (not signed off).
async function requireQuoteScopeEditor(user: AuthUser, workOrderId: string) {
  const loaded = await requireWritableWorkOrder(user, workOrderId);
  if (!canEditQuoteScope(user.role)) {
    throw Forbidden(
      "Only the office can change the quoted work. Report extra work instead.",
    );
  }
  return loaded;
}

// Load + serialize a workOrder (role-aware DTO with price-stripping).
async function readWorkOrder(user: AuthUser, workOrderId: string) {
  const wb = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: workOrderInclude,
  });
  if (!wb) throw NotFound("Work order not found");
  return await workOrderDto(wb as WorkOrderWithRelations, user.role as UserRole);
}

// Reload after a mutation. Recompute the denormalized list status only on the
// write path; doing this on every detail read added an unnecessary database
// read/update before the page could render.
async function reloadWorkOrder(user: AuthUser, workOrderId: string) {
  // Every mutating work-order route funnels through here on its way to the
  // response, so recomputing the denormalized listStatus here keeps it in sync
  // after ANY change (task toggle/start/end, completion, material edits) without
  // dotting the call across ~10 transaction sites. Runs post-commit on `prisma`.
  await recomputeWorkOrderStatus(prisma, workOrderId);
  return readWorkOrder(user, workOrderId);
}

// Load a task belonging to a workOrder, or 404.
async function loadTask(workOrderId: string, taskId: string) {
  const task = await prisma.workOrderTask.findFirst({
    where: { id: taskId, workOrderId },
    include: { materials: true },
  });
  if (!task) throw NotFound("Task not found");
  return task;
}

// Load a material via task → workOrder (used by /materials/:matId flat routes).
async function loadMaterial(workOrderId: string, matId: string) {
  const mat = await prisma.taskMaterial.findFirst({
    where: { id: matId, task: { workOrderId } },
  });
  if (!mat) throw NotFound("Material not found");
  return mat;
}

// Derive a task's `done` from its lines: a zone is done when it has at least one
// named (non-empty) line and every named line is done. Mirrors the client's
// zone status badge (see ZoneStatusBadge) so the persisted task.done — which
// feeds listStatus / planning / dashboard — never drifts from what's shown.
// Call inside the same tx after any line add/update/delete/toggle.
async function syncTaskDone(tx: Tx, taskId: string): Promise<void> {
  const lines = await tx.taskMaterial.findMany({
    where: { taskId },
    select: { name: true, label: true, done: true },
  });
  const named = lines.filter((l) => (l.name ?? "").trim() || (l.label ?? "").trim());
  const done = named.length > 0 && named.every((l) => l.done);
  await tx.workOrderTask.update({ where: { id: taskId }, data: { done } });
}

// Human-readable scope for activity bodies (task description or workOrder title).
function taskScopeLabel(
  task: { description: string } | null,
  workOrderTitle: string,
): string {
  return task?.description?.trim() || workOrderTitle || "—";
}

// Work-order display label for activity: its title, or "#N" when untitled.
function woLabel(wb: { title: string; ordinal: number }): string {
  return wb.title.trim() || `#${wb.ordinal + 1}`;
}

// =========================================================================
// LIST + DETAIL
// =========================================================================

// The status buckets shown as filter chips + count pills on the list.
const WORK_ORDER_STATUSES = workOrderStatusIds;

// GET /work-orders?projectId=&cursor=&limit=&search=&status= — cursor-paginated,
// server-searched (number/customer/city) and server-filtered by the denormalized
// listStatus. Returns { items, nextCursor, counts } where counts is the per-status
// totals across the WHOLE (visibility-scoped) set, so the count pills stay accurate
// no matter how many pages are loaded. When projectId is given, scopes to that
// (visible) project.
workOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { limit, cursor, search } = parsePageParams(req);
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const statusFilter =
      typeof req.query.status === "string" &&
      (WORK_ORDER_STATUSES as readonly string[]).includes(req.query.status)
        ? req.query.status
        : undefined;

    // Org + optional project narrowing. Role VISIBILITY is NOT applied here —
    // it is a work-order-level question (assignment is per werkbon), so it comes
    // from visibleWorkOrdersWhere below and is ANDed onto the filter list.
    const projectWhere: Prisma.ProjectWhereInput = {
      orgId: user.orgId,
      deletedAt: null,
      ...(projectId ? { id: projectId } : {}),
    };

    // Narrowing filters, so a werkbon can still be found months later ("improve
    // the filters in the work order overview" — WOB Isolatie, 17-07-2026). All
    // optional; each is ANDed onto the visibility filter below.
    const customerId =
      typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const assigneeId =
      typeof req.query.assigneeId === "string" ? req.query.assigneeId : undefined;
    // "Type werk" filter: the MATERIAL on the werkbon's lines — the same thing
    // the list's "Type werk" column shows (derived from line articles), so
    // column and filter agree. Not the WorkType table.
    const materialId =
      typeof req.query.materialId === "string" ? req.query.materialId : undefined;
    // Date range on plannedDate, inclusive both ends. plannedDate is a plain
    // "YYYY-MM-DD" STRING column, not a DateTime — that format sorts and
    // compares lexicographically, so gte/lte on the raw string is correct and
    // needs no timezone handling. Anything not in that shape is ignored rather
    // than 400: a stale bookmark shouldn't error.
    const isoDay = (v: unknown): string | undefined =>
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
    const dateFrom = isoDay(req.query.dateFrom);
    const dateTo = isoDay(req.query.dateTo);

    // Customer filter — NEVER for a client role. Their projectWhere.customerId
    // is their identity, not a preference; honouring a customerId query param
    // here would overwrite it and let them list another customer's work orders.
    if (customerId && user.role !== "client") {
      projectWhere.customerId = customerId;
    }

    // Base visibility filter (shared by counts + the page query). Search matches
    // the same project fields the global search does (number/customer/city/title).
    //
    // Fragments are collected and ANDed — never spread onto one object, because
    // two fragments that both use OR would clobber each other and silently widen
    // visibility (the projectScopeWhere bug). Same reasoning here.
    const filters: Prisma.WorkOrderWhereInput[] = [
      { project: projectWhere },
      // Role visibility at the WERKBON level: a technician sees only the
      // werkbonnen assigned to them, never every werkbon of a project they
      // happen to be crewed on.
      visibleWorkOrdersWhere(user),
    ];

    if (search) {
      const ci = { contains: search, mode: "insensitive" as const };
      filters.push({
        OR: [
          { title: ci },
          { project: { is: { projectNumber: ci } } },
          { project: { is: { customerName: ci } } },
          { project: { is: { city: ci } } },
        ],
      });
    }

    // Assignee matches either the werkbon's own assignees or a per-zone
    // assignee, since a monteur can be attached at either level.
    if (assigneeId) {
      filters.push({
        OR: [
          { assignees: { some: { id: assigneeId } } },
          { tasks: { some: { assigneeId } } },
        ],
      });
    }

    // Lines live per zone, so a werkbon matches when any zone has a line on
    // that material.
    if (materialId) {
      filters.push({
        tasks: { some: { materials: { some: { variant: { is: { materialId } } } } } },
      });
    }

    if (dateFrom || dateTo) {
      filters.push({
        plannedDate: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        },
      });
    }

    const baseWhere: Prisma.WorkOrderWhereInput =
      filters.length === 1 ? filters[0] : { AND: filters };

    // Per-status counts across the whole scoped+searched set (not just the page).
    const grouped = await prisma.workOrder.groupBy({
      by: ["listStatus"],
      where: baseWhere,
      _count: { _all: true },
    });
    const counts: Record<string, number> = { total: 0 };
    for (const s of WORK_ORDER_STATUSES) counts[s] = 0;
    for (const g of grouped) {
      counts[g.listStatus] = g._count._all;
      counts.total += g._count._all;
    }

    // The page itself: apply the status filter on top of the base filter.
    const pageWhere: Prisma.WorkOrderWhereInput = statusFilter
      ? { AND: [baseWhere, { listStatus: statusFilter }] }
      : baseWhere;

    const page = await paginate({ limit, cursor, search }, (args) =>
      prisma.workOrder.findMany({
        where: pageWhere,
        include: workOrderListInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...args,
      }),
    );

    res.json({
      items: page.items.map((wb) => workOrderListDto(wb)),
      nextCursor: page.nextCursor,
      counts,
    });
  }),
);

// GET /work-orders/assignable?date=&endDate=&role= — field staff {id, name} for
// per-task assignment. Readable by admin + technician (the employees list is
// admin-only, but technicians assign tasks on the detail screen). Must precede
// "/:id".
//
// `role` (project_leader | technician) narrows the list by JOB TITLE so the
// project-leader picker doesn't offer the whole payroll. It only narrows:
// employees with no title set are always included (see assignableWhere) so an
// org that never filled the field in can still assign someone. An unknown
// value is rejected rather than silently ignored, so a typo can't quietly
// return the unfiltered list.
//
// When a date (or range) is supplied, anyone with an absence overlapping it is
// annotated `unavailable` with the reason. They are RETURNED, not removed: the
// office needs to see that Jan exists and is on holiday, otherwise a missing
// name reads as "no longer employed". The picker greys them out.
workOrdersRouter.get(
  "/assignable",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === "client") throw Forbidden("Not allowed");

    // An absent OR EMPTY `role` means "everyone assignable" — `?role=` is what a
    // cleared picker sends, and 400-ing on it would break the unfiltered list
    // rather than widening it. Only a non-empty unknown value is an error.
    // (Same rule as the materials category filter.)
    const rawRole = req.query.role === "" ? undefined : req.query.role;
    const parsedRole =
      rawRole === undefined ? undefined : assignableRoleFilterSchema.safeParse(rawRole);
    if (parsedRole && !parsedRole.success) throw BadRequest("Unknown role filter");

    const rows = await prisma.employee.findMany({
      where: {
        orgId: user.orgId,
        deletedAt: null,
        status: "active",
        ...(parsedRole?.success ? assignableWhere(parsedRole.data) : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const from = isIsoDay(req.query.date) ? req.query.date : undefined;
    if (!from) {
      res.json(rows);
      return;
    }
    const to = isIsoDay(req.query.endDate) ? req.query.endDate : from;

    const absences = await absencesInRange(
      user.orgId,
      from,
      to,
      rows.map((r) => r.id),
    );
    const byEmployee = new Map(absences.map((a) => [a.employeeId, a]));
    res.json(
      rows.map((r) => {
        const a = byEmployee.get(r.id);
        return a
          ? {
              ...r,
              unavailable: {
                kind: a.kind,
                startDate: a.startDate,
                endDate: a.endDate,
              },
            }
          : r;
      }),
    );
  }),
);

// GET /work-orders/filter-options — the dropdown contents for the overview's
// filter bar: customers, assignable staff, and materials. Must precede "/:id",
// or Express matches this path as an id.
//
// Each list is scoped the same way the work-order list itself is, so the filter
// menu can never hint at data the requester can't see: a technician only gets
// customers/colleagues appearing on their own werkbons, and a client gets
// nothing but their own customer.
workOrdersRouter.get(
  "/filter-options",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Scope the options through the WERKBON visibility rule (assignment is per
    // werkbon), so a technician's filter menu only names customers that appear
    // on werkbonnen they're actually on.
    const visibleWorkOrders = workOrderScopeWhere(user);

    const [customers, assignees, materials] = await Promise.all([
      prisma.customer.findMany({
        where: {
          orgId: user.orgId,
          deletedAt: null,
          projects: { some: { workOrders: { some: visibleWorkOrders } } },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      // Assignable staff: only meaningful for someone who can see more than
      // their own werkbons, so clients get an empty list.
      user.role === "client"
        ? Promise.resolve([])
        : prisma.employee.findMany({
            where: { orgId: user.orgId, deletedAt: null, status: "active" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
      // Materials that appear on a visible werkbon's lines — the values the
      // "Type werk" column can show, so the filter offers exactly those.
      prisma.material.findMany({
        where: {
          orgId: user.orgId,
          variants: {
            some: { taskMaterials: { some: { task: { is: { workOrder: { is: visibleWorkOrders } } } } } },
          },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    res.json({ customers, assignees, materials });
  }),
);

// GET /work-orders/:id — one workOrder, full nested, role-aware DTO.
// GET /:id/pdf — the werkbon as a downloadable PDF. Visibility-checked like the
// detail read; prices stripped for technicians. Streams application/pdf. Must be
// registered BEFORE "/:id" so it isn't swallowed by the param route.
workOrdersRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await loadProjectForWorkOrder(user, req.params.id); // visibility (404 if not)

    const wb = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      include: {
        ...workOrderInclude,
        project: {
          select: {
            projectNumber: true,
            customerName: true,
            address: true,
            postalCode: true,
            city: true,
            insulationType: true,
            // Fallback for the printed job description when this werkbon
            // carries none of its own.
            description: true,
            // Site contact for THIS job — overrides the customer's default
            // contact on the printed werkbon (see below).
            contactName: true,
            contactPhone: true,
            customer: { select: { contactName: true, phone: true, email: true } },
          },
        },
      },
    });
    if (!wb) throw NotFound("Work order not found");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.orgId },
    });
    // The PDF prints THIS werkbon's own checklist (its snapshotted items), in
    // order, with their labels + done state — independent of the org template.
    const woPrejobItems = [...(wb.prejobItems ?? [])].sort((a, b) => a.ordinal - b.ordinal);
    const prejobLabels: Record<string, string> = {};
    const prejobCheck: Record<string, boolean> = {};
    for (const it of woPrejobItems) {
      prejobLabels[it.key] = it.label;
      prejobCheck[it.key] = it.done;
    }

    const sortedTasks = [...wb.tasks].sort((a, b) => a.ordinal - b.ordinal);
    const pdfData: WorkOrderPdfData = {
      number: wb.project.projectNumber,
      ordinal: wb.ordinal,
      title: wb.title,
      status: wb.listStatus,
      createdAt: wb.createdAt,
      customer: {
        name: wb.project.customerName,
        // The contact selected for THIS visit wins. Older work orders without a
        // selection retain the project/customer fallback.
        contactName:
          wb.contacts.map((contact) => contact.name).filter(Boolean).join(", ") ||
          wb.project.contactName ||
          wb.project.customer?.contactName ||
          undefined,
        contactPhone:
          wb.contacts.map((contact) => contact.phone).filter(Boolean).join(", ") ||
          wb.project.contactPhone ||
          wb.project.customer?.phone ||
          undefined,
        contactEmail:
          wb.contacts.map((contact) => contact.email).filter(Boolean).join(", ") ||
          wb.project.customer?.email ||
          undefined,
        address: wb.project.address || undefined,
        postalCode: wb.project.postalCode || undefined,
        city: wb.project.city || undefined,
      },
      insulationType: wb.project.insulationType || undefined,
      // The planned visit — dates from the werkbon, times from its slot.
      plannedDate: wb.plannedDate ?? undefined,
      plannedEndDate: wb.plannedEndDate ?? undefined,
      startTime: wb.planningItems?.[0]?.startTime ?? undefined,
      endTime: wb.planningItems?.[0]?.endTime ?? undefined,
      // The werkbon's OWN description wins; the project's is the fallback (a
      // project groups many visits, so its text is the generic one).
      jobDescription:
        wb.description?.trim() || wb.project.description?.trim() || undefined,
      tasks: sortedTasks.map((t) => ({
        description: t.description,
        // The zone's "Werkomschrijving" — stored as `note`. It was never passed
        // to the builder, so the one thing the office types per zone never
        // reached the printed werkbon.
        note: t.note,
        workTypeName: t.workType?.name ?? undefined,
        assigneeName: t.assignee?.name ?? undefined,
        done: t.done,
        materials: [...t.materials]
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((m) => ({
            name: m.name,
            quantity: m.quantity,
            unit: m.unit,
            // Deliberately no unitPrice: the werkbon is priceless for every
            // role, so the price never even reaches the document.
            isExtraWork: m.isExtraWork,
            approvedByOffice: m.approvedByOffice,
            approvedByClient: m.approvedByClient,
            rejected: m.rejected,
          })),
        beforePhotos: t.beforePhotos,
        resultPhotos: t.resultPhotos,
      })),
      // This werkbon's own checklist (key → done) + labels, in order.
      prejobCheck,
      prejobLabels,
      prejobPhotos: wb.prejobPhotos,
      // Drawings/documents go ON the printed werkbon: images as full pages,
      // PDFs listed by name (pdfkit cannot merge them).
      attachments: wb.attachments.map((a) => ({
        key: a.key,
        filename: a.filename,
        contentType: a.contentType,
      })),
      dispatchedAt: wb.dispatchedAt,
      signature: wb.signature,
      signedByName: wb.signedByName ?? wb.signedBy?.name ?? undefined,
      signedAt: wb.signedAt,
    };

    const filename = `werkbon-${wb.project.projectNumber}-${wb.ordinal + 1}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // No prices on the werkbon, for any role — see buildWorkOrderPdf.
    await buildWorkOrderPdf(pdfData, { org }, res);
  }),
);

// How long a quote (offerte) stays valid, matching the org's paper documents.
const QUOTE_VALIDITY_DAYS = 35;

// Next quote number for the org: YYYYNNNN (e.g. 20260063). Same scan-the-max
// approach as projectNumber generation (projects routes). WorkOrder has no
// orgId, so scope via the parent project.
async function nextQuoteNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await prisma.workOrder.findMany({
    where: { project: { orgId }, quoteNumber: { startsWith: String(year) } },
    select: { quoteNumber: true },
  });
  let max = 0;
  for (const { quoteNumber } of existing) {
    const m = quoteNumber?.match(/^\d{4}(\d{4})$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${year}${String(max + 1).padStart(4, "0")}`;
}

// GET /work-orders/:id/quote-pdf — the werkbon as a customer-facing quote
// (offerte) PDF. ADMIN ONLY: it's a commercial document with prices always
// shown. Assigns a stable quote number + date on first export. Registered
// BEFORE "/:id" so it isn't swallowed by the param route.
workOrdersRouter.get(
  "/:id/quote-pdf",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await loadProjectForWorkOrder(user, req.params.id); // org scoping (404 if not)

    const wb = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      include: {
        ...workOrderInclude,
        project: {
          select: {
            customerName: true,
            address: true,
            postalCode: true,
            city: true,
            customer: { select: { contactName: true } },
          },
        },
      },
    });
    if (!wb) throw NotFound("Work order not found");

    // First export assigns the document identity; later exports reuse it so the
    // customer's copy never changes number.
    let quoteNumber = wb.quoteNumber;
    let quoteDate = wb.quoteDate;
    if (!quoteNumber || !quoteDate) {
      quoteNumber = quoteNumber ?? (await nextQuoteNumber(user.orgId));
      quoteDate = quoteDate ?? new Date();
      await prisma.$transaction(async (tx) => {
        await tx.workOrder.update({
          where: { id: wb.id },
          data: { quoteNumber, quoteDate },
        });
        await audit(tx, user, "workOrder.quote.export", "workOrder", wb.id, {
          quoteNumber,
        });
      });
    }
    const expiryDate = new Date(quoteDate.getTime() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.orgId },
    });

    const sortedTasks = [...wb.tasks].sort((a, b) => a.ordinal - b.ordinal);
    const pdfData: QuotePdfData = {
      quoteNumber,
      quoteDate,
      expiryDate,
      title: wb.title,
      customer: {
        name: wb.project.customerName,
        contactName:
          wb.contacts.map((contact) => contact.name).filter(Boolean).join(", ") ||
          wb.project.customer?.contactName ||
          undefined,
        address: wb.project.address || undefined,
        postalCode: wb.project.postalCode || undefined,
        city: wb.project.city || undefined,
      },
      groups: sortedTasks.map((t) => ({
        heading: t.description,
        // A quote is what's being SOLD. Meerwerk is by definition not part of
        // it (and matches recomputeQuoteAmount, which builds the quote total
        // from non-meerwerk lines only), so it never appears here.
        lines: [...t.materials]
          .filter((m) => !m.isExtraWork)
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((m) => ({
            quantity: m.quantity,
            unit: m.unit,
            name: m.name,
            unitPrice: m.unitPrice,
          })),
      })),
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="offerte-${quoteNumber}.pdf"`);
    await buildQuotePdf(pdfData, { org }, res);
  }),
);

workOrdersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await loadProjectForWorkOrder(user, req.params.id); // visibility (404 if not)
    res.json(await readWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// WORK ORDER CRUD
// =========================================================================

// POST /work-orders {projectId, title?, description?} — create. Admin only: setting up a
// werkbon (customer + project context) is an office task. Technicians are
// ASSIGNED werkbons and fill them in (tasks/photos/signature) via the write
// endpoints below — they don't create. See shared/src/permissions.ts.
workOrdersRouter.post(
  "/",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createWorkOrderSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, orgId: user.orgId, deletedAt: null },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        teamLeaderId: true,
        projectLeaderId: true,
        installers: { select: { id: true } },
      },
    });
    if (!project) {
      throw NotFound("Project not found");
    }

    const requestedContactIds = [
      ...(input.contactPersonIds ?? []),
      ...(input.contactPersonId ? [input.contactPersonId] : []),
    ];
    const uniqueContactIds = [...new Set(requestedContactIds)];
    const contactPersons = uniqueContactIds.length
      ? await prisma.contactPerson.findMany({
          where: {
            id: { in: uniqueContactIds },
            OR: [
              { customerId: project.customerId },
              { sharedCustomers: { some: { id: project.customerId } } },
            ],
          },
          select: { id: true },
        })
      : [];
    if (contactPersons.length !== uniqueContactIds.length) {
      throw BadRequest("One or more contact persons do not belong to this project's customer");
    }

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.workOrder.count({
        where: { projectId: project.id },
      });
      const wb = await tx.workOrder.create({
        data: {
          projectId: project.id,
          contacts:
            contactPersons.length > 0
              ? { connect: contactPersons.map(({ id }) => ({ id })) }
              : undefined,
          // Empty title → the client renders a translated fallback that includes
          // the 1-based index. No display prose stored in the DB.
          title: input.title?.trim() ?? "",
          // Optional per-visit description; null when not supplied, so the
          // printed werkbon falls back to the project's.
          description: clampText(input.description ?? "").trim() || null,
          drawings: [],
          ordinal: count,
          // Billing is per-werkbon: each werkbon gets its own quote + invoice.
          quote: { create: { status: "draft", amount: 0 } },
          invoice: { create: { status: "not_started" } },
        },
        include: workOrderInclude,
      });
      // Selecting a contact for a visit also makes that person available on the
      // parent project. Prisma's connect is idempotent for the join table.
      if (contactPersons.length > 0) {
        await tx.project.update({
          where: { id: project.id },
          data: {
            contacts: {
              connect: contactPersons.map(({ id }) => ({ id })),
            },
          },
        });
      }
      // Snapshot the org's ACTIVE pre-job template into THIS werkbon's own item
      // rows. From here the werkbon owns its checklist — editing the template
      // later won't change it, and editing it won't touch the template.
      const template = await tx.prejobCheckItem.findMany({
        where: { orgId: project.orgId, active: true },
        orderBy: { ordinal: "asc" },
        select: {
          key: true,
          label: true,
          reminderEnabled: true,
          reminderTime: true,
        },
      });
      if (template.length > 0) {
        await tx.workOrderPrejobItem.createMany({
          data: template.map((it, i) => ({
            workOrderId: wb.id,
            key: it.key,
            label: it.label,
            done: false,
            reminderEnabled: it.reminderEnabled,
            reminderTime: it.reminderTime,
            ordinal: i,
          })),
        });
      }
      // Seed the denormalized listStatus (e.g. "urgent" if the project already is).
      await recomputeWorkOrderStatus(tx, wb.id);
      await appendActivity(tx, user, project.id, "workOrder.created", {
        title: woLabel(wb),
      });
      await audit(tx, user, "workOrder.create", "workOrder", wb.id, {
        projectId: project.id,
      });
      return wb;
    });
    // Reload so the snapshotted pre-job items (created after `created` was
    // loaded) are included in the response.
    res.status(201).json(await reloadWorkOrder(user, created.id));
  }),
);

// PATCH /work-orders/:id {title?} — admin only.
workOrdersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateWorkOrderSchema.parse(req.body);
    const { project } = await loadProjectForWorkOrder(user, req.params.id); // visibility (404 if not)
    if (!canEditQuoteScope(user.role)) throw Forbidden("Office only");
    // Validate every assigned monteur belongs to the org (a full-crew replace).
    if (input.assigneeIds !== undefined && input.assigneeIds.length > 0) {
      const found = await prisma.employee.count({
        where: { id: { in: input.assigneeIds }, orgId: user.orgId, deletedAt: null },
      });
      if (found !== new Set(input.assigneeIds).size) {
        throw BadRequest("One or more assignees not found in organization");
      }
    }
    if (input.contactPersonIds !== undefined && input.contactPersonIds.length > 0) {
      const uniqueIds = [...new Set(input.contactPersonIds)];
      const found = await prisma.contactPerson.count({
        where: {
          id: { in: uniqueIds },
          OR: [
            { customerId: project.customerId },
            { sharedCustomers: { some: { id: project.customerId } } },
          ],
        },
      });
      if (found !== uniqueIds.length) {
        throw BadRequest("One or more contacts do not belong to this customer");
      }
    }
    // The schedule fields are NOT written straight to the columns here: the
    // calendar draws PlanningItems, which shadow plannedDate, so a bare column
    // write would move the werkbon's date while the calendar kept showing the
    // old slot. Both stores go through the shared planning service instead.
    const timesChanged =
      input.startTime !== undefined || input.endTime !== undefined;
    const schedulingChanged =
      input.plannedDate !== undefined ||
      input.plannedEndDate !== undefined ||
      timesChanged;
    const scheduleTarget = schedulingChanged
      ? await prisma.workOrder.findUniqueOrThrow({
          where: { id: req.params.id },
          select: {
            id: true,
            projectId: true,
            plannedDate: true,
            plannedEndDate: true,
            planningItems: {
              orderBy: { date: "asc" },
              select: { id: true, startTime: true, endTime: true },
            },
            assignees: { select: { id: true } },
            project: { select: { projectLeaderId: true, teamLeaderId: true } },
          },
        })
      : null;
    if (scheduleTarget && timesChanged) {
      // A one-sided time change must still leave start < end against what the
      // slot keeps (or, for a new slot, gets as default).
      const slot = scheduleTarget.planningItems[0];
      const effectiveStart =
        input.startTime ?? slot?.startTime ?? DEFAULT_START_TIME;
      const effectiveEnd = input.endTime ?? slot?.endTime ?? DEFAULT_END_TIME;
      if (effectiveStart >= effectiveEnd) {
        throw BadRequest("endTime must be after startTime");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: {
          title: input.title !== undefined ? clampText(input.title) : undefined,
          // This visit's own description; cleared to null when blanked, so the
          // printed werkbon falls back to the project's description again.
          ...(input.description !== undefined
            ? { description: clampText(input.description).trim() || null }
            : {}),
          // Full replace of the assigned crew when assigneeIds is provided.
          ...(input.assigneeIds !== undefined
            ? { assignees: { set: input.assigneeIds.map((id) => ({ id })) } }
            : {}),
          // Full replace of this visit's selected contacts; an empty array
          // deliberately clears them without deleting the central contacts.
          ...(input.contactPersonIds !== undefined
            ? {
                contacts: {
                  set: [...new Set(input.contactPersonIds)].map((id) => ({ id })),
                },
              }
            : {}),
          // THIS visit's priority. listStatus resyncs via reloadWorkOrder on
          // the way out — same row, same request, no cross-table sync needed.
          ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
          // Per-werkbon photo requirement for the dispatch gate.
          ...(input.prejobPhotoRequired !== undefined
            ? { prejobPhotoRequired: input.prejobPhotoRequired }
            : {}),
        },
      });

      if (input.contactPersonIds && input.contactPersonIds.length > 0) {
        await tx.project.update({
          where: { id: project.id },
          data: {
            contacts: {
              connect: [...new Set(input.contactPersonIds)].map((id) => ({ id })),
            },
          },
        });
      }

      if (scheduleTarget) {
        const nextStart =
          input.plannedDate !== undefined
            ? input.plannedDate || null
            : scheduleTarget.plannedDate;
        if (!nextStart) {
          // A time needs a scheduled visit to belong to — and sending one in
          // the same patch that clears the date is contradictory.
          if (timesChanged) {
            throw BadRequest("Cannot set a time on an unscheduled work order");
          }
          // No start date = not planned: drop the slots too, or the werkbon
          // would linger on the calendar via a now-orphaned PlanningItem.
          await clearWorkOrderSchedule(tx, user, scheduleTarget);
        } else if (input.plannedDate !== undefined || timesChanged) {
          // Move (or create) the slot. Crew and vehicle are deliberately not
          // passed — the slot keeps what the office set on the Planning screen.
          // Times pass through only when the patch carries them, so a bare
          // date move still preserves the slot's times.
          await applyWorkOrderSchedule(tx, user, scheduleTarget, {
            date: nextStart,
            ...(input.plannedEndDate !== undefined
              ? { endDate: input.plannedEndDate || null }
              : {}),
            ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
            ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
          });
        } else {
          // End date only — the start (and therefore the slot) is unchanged.
          await setWorkOrderEndDate(
            tx,
            user,
            scheduleTarget,
            input.plannedEndDate || null,
          );
        }
      }

      await audit(tx, user, "workOrder.update", "workOrder", req.params.id, input);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id — admin only. (Technician may NOT delete a workOrder.)
workOrdersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await loadProjectForWorkOrder(user, req.params.id);
    if (!canEditQuoteScope(user.role)) throw Forbidden("Office only");
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true, ordinal: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.delete({ where: { id: req.params.id } });
      await appendActivity(tx, user, project.id, "workOrder.deleted", {
        title: woLabel(wb),
      });
      await audit(tx, user, "workOrder.delete", "workOrder", req.params.id);
      // No quote recompute: billing is per-werkbon and the werkbon (with its
      // own quote/value) is now deleted — nothing to recompute.
    });
    res.status(204).end();
  }),
);

// A deliberate office override for moving backwards or jumping to another
// operational state. Billing states use the invoice routes so their amounts and
// dates stay correct.
workOrdersRouter.patch(
  "/:id/status",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = setWorkOrderStatusSchema.parse(req.body);
    const targetIndex = workOrderStatusIds.indexOf(input.status);
    if (targetIndex >= workOrderStatusIds.indexOf("ready_to_invoice")) {
      throw BadRequest("Financial statuses must use the invoice workflow");
    }

    const { project } = await loadProjectForWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: {
        title: true,
        ordinal: true,
        listStatus: true,
        signature: true,
        dispatchedAt: true,
        invoice: { select: { id: true } },
      },
    });
    const clearsSignature = targetIndex < workOrderStatusIds.indexOf("ready_for_review");
    const isDispatched = targetIndex >= workOrderStatusIds.indexOf("released");
    const isApproved = targetIndex >= workOrderStatusIds.indexOf("approved");

    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: {
          statusOverride: input.status,
          listStatus: input.status,
          approvedBySupervisor: isApproved,
          ...(isDispatched
            ? {
                dispatchedAt: wb.dispatchedAt ?? new Date(),
                dispatchedById: wb.dispatchedAt ? undefined : user.id,
              }
            : { dispatchedAt: null, dispatchedById: null }),
          ...(clearsSignature
            ? { signature: null, signedByName: null, signedAt: null, signedById: null }
            : {}),
        },
      });
      if (wb.invoice) {
        await tx.invoice.update({
          where: { id: wb.invoice.id },
          data: { status: "not_started", sentDate: null, paidDate: null },
        });
      }
      await appendActivity(tx, user, project.id, "workOrder.statusOverridden", {
        title: woLabel(wb),
        from: wb.listStatus,
        to: input.status,
      });
      await audit(tx, user, "workOrder.status.override", "workOrder", req.params.id, {
        from: wb.listStatus,
        to: input.status,
      });
    });
    if (clearsSignature && wb.signature) await deleteStored(wb.signature);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/approve — toggle approvedBySupervisor. admin only.
workOrdersRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await loadProjectForWorkOrder(user, req.params.id);
    if (!canEditQuoteScope(user.role)) throw Forbidden("Office only");
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: {
        approvedBySupervisor: true,
        signedAt: true,
        invoice: { select: { status: true } },
        title: true,
        ordinal: true,
      },
    });
    const next = !wb.approvedBySupervisor;
    if (next && !wb.signedAt) {
      throw BadRequest("A work order must be signed before approval");
    }
    if (!next && wb.invoice && wb.invoice.status !== "not_started") {
      throw BadRequest("A work order with an invoice in progress cannot be unapproved");
    }
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { approvedBySupervisor: next, statusOverride: null },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        next ? "workOrder.approved" : "workOrder.unapproved",
        { title: woLabel(wb) },
      );
      await audit(tx, user, "workOrder.approve", "workOrder", req.params.id, {
        approvedBySupervisor: next,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/drawings — upload a drawing (image or PDF). admin or
// technician-assigned. multipart "file".
workOrdersRouter.post(
  "/:id/drawings",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const key = await storeUpload(user, req.file, "wo-drawing", req.params.id, {
      allowPdf: true,
    });
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { drawings: { push: key } },
      });
      await audit(tx, user, "workOrder.drawing.add", "workOrder", req.params.id, {
        drawing: key,
      });
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/drawings {photo} — remove a drawing by its object key.
workOrdersRouter.delete(
  "/:id/drawings",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = removePhotoSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      select: { drawings: true },
    });
    if (!wb) throw NotFound("Work order not found");
    const existed = wb.drawings.includes(input.photo);
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { drawings: wb.drawings.filter((d) => d !== input.photo) },
      });
      await audit(tx, user, "workOrder.drawing.remove", "workOrder", req.params.id, {
        drawing: input.photo,
      });
    });
    if (existed) await deleteStored(input.photo);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/attachments — upload a document (PDF or image) for the
// whole job. admin or technician-assigned. multipart "file". Keeps the original
// filename so the attachments list shows real names (unlike drawings).
workOrdersRouter.post(
  "/:id/attachments",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    // Optional multipart text field: "document" (default) or "packing_slip".
    const kind = req.body?.kind === "packing_slip" ? "packing_slip" : "document";
    const meta = await storeAttachment(user, req.file, req.params.id);
    await prisma.$transaction(async (tx) => {
      const row = await tx.workOrderAttachment.create({
        data: {
          workOrderId: req.params.id,
          key: meta.key,
          filename: meta.filename,
          contentType: meta.contentType,
          size: meta.size,
          uploadedById: user.id,
          kind,
        },
      });
      await audit(tx, user, "workOrder.attachment.add", "workOrderAttachment", row.id, {
        filename: meta.filename,
      });
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/attachments/:attachmentId/received {received} — confirm
// (or un-confirm) receipt of a packing slip's delivery. Packing slips only.
workOrdersRouter.post(
  "/:id/attachments/:attachmentId/received",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const received = req.body?.received === true;
    const row = await prisma.workOrderAttachment.findFirst({
      where: { id: req.params.attachmentId, workOrderId: req.params.id },
    });
    if (!row) throw NotFound("Attachment not found");
    if (row.kind !== "packing_slip") throw BadRequest("Not a packing slip");
    await prisma.$transaction(async (tx) => {
      await tx.workOrderAttachment.update({
        where: { id: row.id },
        data: { receivedAt: received ? new Date() : null },
      });
      await audit(tx, user, "workOrder.attachment.received", "workOrderAttachment", row.id, {
        filename: row.filename,
        received,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/attachments/:attachmentId — remove an attachment.
workOrdersRouter.delete(
  "/:id/attachments/:attachmentId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    // Scope the row to THIS work order so an id from another werkbon 404s.
    const row = await prisma.workOrderAttachment.findFirst({
      where: { id: req.params.attachmentId, workOrderId: req.params.id },
    });
    if (!row) throw NotFound("Attachment not found");
    await prisma.$transaction(async (tx) => {
      await tx.workOrderAttachment.delete({ where: { id: row.id } });
      await audit(tx, user, "workOrder.attachment.remove", "workOrderAttachment", row.id, {
        filename: row.filename,
      });
    });
    await deleteStored(row.key);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// PRE-JOB CHECK + DISPATCH GATE
// A monteur may not be dispatched until the pre-job checklist is complete AND
// at least one pre-job photo is attached.
// =========================================================================

// The pre-job checklist is PER WERKBON and admin-managed (technicians don't
// create/configure werkbonnen — they fill in tasks/photos/signature). These
// routes edit THIS werkbon's own items; they must not be editable once the
// werkbon has been dispatched.

// Slugify a label into a stable key base (lowercase, ascii-ish, underscores).
function slugifyPrejob(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "item";
}

// Load the werkbon (org-scoped) + assert it's not yet dispatched, or throw.
async function requireEditablePrejob(user: AuthUser, workOrderId: string) {
  const wb = await prisma.workOrder.findFirst({
    where: { id: workOrderId, project: { orgId: user.orgId, deletedAt: null } },
    select: { id: true, dispatchedAt: true },
  });
  if (!wb) throw NotFound("Work order not found");
  if (wb.dispatchedAt) throw BadRequest("Work order is already dispatched");
  return wb;
}

// PATCH /work-orders/:id/prejob-items/:itemId {done?, label?} — tick or rename
// one item on this werkbon. admin only.
workOrdersRouter.patch(
  "/:id/prejob-items/:itemId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateWorkOrderPrejobItemSchema.parse(req.body);
    await loadProjectForWorkOrder(user, req.params.id);
    if (!isStaff(user.role)) throw Forbidden("Staff only");
    if (input.label !== undefined && !canEditQuoteScope(user.role)) {
      throw Forbidden("Only the office can rename control items");
    }
    await requireEditablePrejob(user, req.params.id);
    const item = await prisma.workOrderPrejobItem.findFirst({
      where: { id: req.params.itemId, workOrderId: req.params.id },
    });
    if (!item) throw NotFound("Checklist item not found");
    const data: { done?: boolean; label?: string } = {};
    if (input.done !== undefined) data.done = input.done;
    if (input.label !== undefined) {
      const label = clampText(input.label).trim();
      if (!label) throw BadRequest("Label required");
      data.label = label;
    }
    await prisma.$transaction(async (tx) => {
      await tx.workOrderPrejobItem.update({ where: { id: item.id }, data });
      await audit(tx, user, "workOrder.prejob.itemUpdate", "workOrderPrejobItem", item.id, data);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/prejob-items {label} — add a one-off item to THIS
// werkbon (does not touch the org template). admin only.
workOrdersRouter.post(
  "/:id/prejob-items",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addWorkOrderPrejobItemSchema.parse(req.body);
    await requireEditablePrejob(user, req.params.id);
    const label = clampText(input.label).trim();
    if (!label) throw BadRequest("Label required");

    const existing = await prisma.workOrderPrejobItem.findMany({
      where: { workOrderId: req.params.id },
      select: { key: true, ordinal: true },
    });
    const taken = new Set(existing.map((e) => e.key));
    const slug = slugifyPrejob(label);
    let key = slug;
    let n = 2;
    while (taken.has(key)) key = `${slug}_${n++}`;
    const ordinal = existing.reduce((m, e) => Math.max(m, e.ordinal), -1) + 1;

    await prisma.$transaction(async (tx) => {
      const created = await tx.workOrderPrejobItem.create({
        data: { workOrderId: req.params.id, key, label, done: false, ordinal },
      });
      await audit(tx, user, "workOrder.prejob.itemAdd", "workOrderPrejobItem", created.id, { key, label });
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/prejob-items/reorder {orderedIds} — admin only.
workOrdersRouter.post(
  "/:id/prejob-items/reorder",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { orderedIds } = reorderPrejobItemsSchema.parse(req.body);
    await requireEditablePrejob(user, req.params.id);
    const owned = await prisma.workOrderPrejobItem.findMany({
      where: { id: { in: orderedIds }, workOrderId: req.params.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));
    await prisma.$transaction(async (tx) => {
      let ordinal = 0;
      for (const id of orderedIds) {
        if (!ownedIds.has(id)) continue;
        await tx.workOrderPrejobItem.update({ where: { id }, data: { ordinal: ordinal++ } });
      }
      await audit(tx, user, "workOrder.prejob.itemReorder", "workOrder", req.params.id, { orderedIds });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/prejob-items/:itemId — remove a one-off/unwanted item
// from THIS werkbon. Hard delete is fine (this is the werkbon's own pre-dispatch
// instance; no cross-werkbon history to protect). admin only.
workOrdersRouter.delete(
  "/:id/prejob-items/:itemId",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireEditablePrejob(user, req.params.id);
    const item = await prisma.workOrderPrejobItem.findFirst({
      where: { id: req.params.itemId, workOrderId: req.params.id },
    });
    if (!item) throw NotFound("Checklist item not found");
    await prisma.$transaction(async (tx) => {
      await tx.workOrderPrejobItem.delete({ where: { id: item.id } });
      await audit(tx, user, "workOrder.prejob.itemRemove", "workOrderPrejobItem", item.id, { key: item.key });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/prejob-photos — upload a pre-job photo (multipart "file").
workOrdersRouter.post(
  "/:id/prejob-photos",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { dispatchedAt: true },
    });
    if (wb.dispatchedAt) throw BadRequest("Work order is already dispatched");
    const key = await storeUpload(user, req.file, "wo-prejob", req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { prejobPhotos: { push: key } },
      });
      await audit(tx, user, "workOrder.prejob.photo.add", "workOrder", req.params.id, {
        photo: key,
      });
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/prejob-photos {photo} — remove a pre-job photo by key.
workOrdersRouter.delete(
  "/:id/prejob-photos",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = removePhotoSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { prejobPhotos: true, dispatchedAt: true },
    });
    if (wb.dispatchedAt) throw BadRequest("Work order is already dispatched");
    const existed = wb.prejobPhotos.includes(input.photo);
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { prejobPhotos: wb.prejobPhotos.filter((p) => p !== input.photo) },
      });
      await audit(tx, user, "workOrder.prejob.photo.remove", "workOrder", req.params.id, {
        photo: input.photo,
      });
    });
    if (existed) await deleteStored(input.photo);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/dispatch — send the monteur out. Hard-gated: requires a
// complete pre-job checklist AND at least one pre-job photo. admin only.
workOrdersRouter.post(
  "/:id/dispatch",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: {
        prejobPhotos: true,
        prejobPhotoRequired: true,
        dispatchedAt: true,
        statusOverride: true,
        title: true,
        ordinal: true,
        prejobItems: { select: { key: true, done: true } },
      },
    });
    if (wb.dispatchedAt) throw BadRequest("Work order is already dispatched");
    const itemKeys = wb.prejobItems.map((i) => i.key);
    const check: Record<string, boolean> = {};
    for (const i of wb.prejobItems) if (i.done) check[i.key] = true;
    if (!canDispatch(check, wb.prejobPhotos.length, itemKeys, wb.prejobPhotoRequired === true)) {
      throw BadRequest("Pre-job check incomplete: complete the checklist and (if required) add a photo");
    }
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: {
          dispatchedAt: new Date(),
          dispatchedById: user.id,
          // A manually selected preparation state keeps moving explicitly.
          // Fresh work orders continue to use automatic derivation.
          statusOverride: wb.statusOverride ? "released" : null,
        },
      });
      await appendActivity(tx, user, project.id, "workOrder.dispatched", {
        title: wb.title || `#${wb.ordinal + 1}`,
      });
      await audit(tx, user, "workOrder.dispatch", "workOrder", req.params.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// TASKS (zones)
// =========================================================================

// POST /work-orders/:id/tasks — add a blank task (zone). admin-only: creating/
// removing zones is office work, not something a technician does in the field
// (they fill in tasks, add photos, capture signatures, and report meerwerk —
// see shared/src/permissions.ts).
workOrdersRouter.post(
  "/:id/tasks",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    await prisma.$transaction(async (tx) => {
      const count = await tx.workOrderTask.count({
        where: { workOrderId: req.params.id },
      });
      const task = await tx.workOrderTask.create({
        data: { workOrderId: req.params.id, ordinal: count },
      });
      await appendActivity(tx, user, project.id, "task.added");
      await audit(tx, user, "workOrder.task.add", "workOrderTask", task.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// PATCH /work-orders/:id/tasks/:taskId — update description/day/done/note plus
// the per-zone work type + assignee (both validated against the org).
//
// FIELD-LEVEL role split (not a whole-route gate — a technician must still be
// able to tick a zone done and leave a note):
//   technician → done, note                     (registering what happened)
//   admin      → + description, day, workTypeId, assigneeId  (the quoted scope)
// Zone title/work-type/assignee define what was sold and who owes it; letting
// a monteur rewrite them silently re-scopes the job. See requireQuoteScopeEditor.
const TASK_SCOPE_FIELDS = ["description", "day", "workTypeId", "assigneeId"] as const;

workOrdersRouter.patch(
  "/:id/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateTaskSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);

    if (!canEditQuoteScope(user.role)) {
      const attempted = TASK_SCOPE_FIELDS.filter((f) => input[f] !== undefined);
      if (attempted.length > 0) {
        throw Forbidden(
          `Only the office can change the quoted work (${attempted.join(", ")}). Report extra work instead.`,
        );
      }
    }

    const task = await loadTask(req.params.id, req.params.taskId);

    // Validate FKs belong to the org (null clears; undefined leaves unchanged).
    if (input.workTypeId) {
      const wt = await prisma.workType.findFirst({
        where: { id: input.workTypeId, orgId: user.orgId },
      });
      if (!wt) throw BadRequest("Work type not found in organization");
    }
    if (input.assigneeId) {
      const emp = await prisma.employee.findFirst({
        where: { id: input.assigneeId, orgId: user.orgId, deletedAt: null },
      });
      if (!emp) throw BadRequest("Employee not found in organization");
    }

    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.update({
        where: { id: task.id },
        data: {
          description:
            input.description !== undefined
              ? clampText(input.description)
              : undefined,
          day: input.day !== undefined ? input.day : undefined,
          done: input.done !== undefined ? input.done : undefined,
          note:
            input.note !== undefined
              ? input.note === null
                ? null
                : clampText(input.note)
              : undefined,
          workTypeId:
            input.workTypeId !== undefined ? input.workTypeId : undefined,
          assigneeId:
            input.assigneeId !== undefined ? input.assigneeId : undefined,
        },
      });
      await audit(tx, user, "workOrder.task.update", "workOrderTask", task.id, input);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/tasks/:taskId — remove a zone. admin-only (see the
// POST /:id/tasks comment above).
workOrdersRouter.delete(
  "/:id/tasks/:taskId",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true },
    });
    const scope = taskScopeLabel(task, wb.title);
    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.delete({ where: { id: task.id } });
      await appendActivity(tx, user, project.id, "task.removed", { scope });
      await audit(tx, user, "workOrder.task.remove", "workOrderTask", task.id);
      await recomputeQuoteAmount(tx, req.params.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/reorder — move activeTaskId to overTaskId's slot.
// Office-only: zone order is scope (it drives the werkbon/quote line order), and
// the UI only shows the drag grip to admins — keep the endpoint in step.
workOrdersRouter.post(
  "/:id/tasks/reorder",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = reorderTasksSchema.parse(req.body);
    const { project } = await requireQuoteScopeEditor(user, req.params.id);
    const tasks = await prisma.workOrderTask.findMany({
      where: { workOrderId: req.params.id },
      orderBy: { ordinal: "asc" },
      select: { id: true },
    });
    const ids = tasks.map((t) => t.id);
    const from = ids.indexOf(input.activeTaskId);
    const to = ids.indexOf(input.overTaskId);
    if (from < 0 || to < 0) throw BadRequest("Task not in this work order");
    if (from !== to) {
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < ids.length; i += 1) {
          await tx.workOrderTask.update({
            where: { id: ids[i] },
            data: { ordinal: i },
          });
        }
        await appendActivity(tx, user, project.id, "task.reordered");
      });
    }
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/toggle — flip task.done.
workOrdersRouter.post(
  "/:id/tasks/:taskId/toggle",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const name = task.description?.trim() || `#${task.ordinal + 1}`;
    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.update({
        where: { id: task.id },
        data: { done: !task.done },
      });
      // Record the completion/reopen in the project activity (audit trail).
      await appendActivity(
        tx,
        user,
        project.id,
        task.done ? "task.toggledReopened" : "task.toggledDone",
        { name },
      );
      await audit(tx, user, "workOrder.task.toggle", "workOrderTask", task.id, {
        done: !task.done,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// TASK TIMING
// =========================================================================

// POST /work-orders/:id/tasks/:taskId/start — set startedAt (once).
workOrdersRouter.post(
  "/:id/tasks/:taskId/start",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    if (!task.startedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.workOrderTask.update({
          where: { id: task.id },
          data: { startedAt: new Date().toISOString() },
        });
        await audit(tx, user, "workOrder.task.start", "workOrderTask", task.id);
      });
    }
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/end — set endedAt, compute hours from
// startedAt (0.25 rounding), mark done.
workOrdersRouter.post(
  "/:id/tasks/:taskId/end",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const endedAt = new Date().toISOString();
    let hours = task.hours ?? undefined;
    if (task.startedAt) {
      const ms = Date.parse(endedAt) - Date.parse(task.startedAt);
      if (ms > 0) hours = msToHours(ms);
    }
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.update({
        where: { id: task.id },
        // Record WHO logged and WHEN it happened: without these, timer-logged
        // hours had no employee and (unless the office set `day`) no date.
        data: {
          endedAt,
          done: true,
          hours: hours ?? null,
          hoursEmployeeId: user.employeeId ?? undefined,
          day: task.day ?? endedAt.slice(0, 10),
        },
      });
      if (task.startedAt) {
        await appendActivity(tx, user, project.id, "task.completedViaTimer", {
          scope: taskScopeLabel(task, wb.title),
          hours: hours ?? 0,
        });
      }
      await audit(tx, user, "workOrder.task.end", "workOrderTask", task.id, { hours });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// PATCH /work-orders/:id/tasks/:taskId/hours {hours} — manual hours override.
workOrdersRouter.patch(
  "/:id/tasks/:taskId/hours",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = taskHoursSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true },
    });
    const next = input.hours > 0 ? input.hours : null;
    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.update({
        where: { id: task.id },
        // Same who/when stamping as the timer end (see /end above).
        data: {
          hours: next,
          hoursEmployeeId: user.employeeId ?? undefined,
          day: task.day ?? new Date().toISOString().slice(0, 10),
        },
      });
      if ((task.hours ?? 0) !== input.hours) {
        await appendActivity(tx, user, project.id, "task.hoursChanged", {
          scope: taskScopeLabel(task, wb.title),
          from: task.hours ?? 0,
          to: input.hours > 0 ? input.hours : 0,
        });
      }
      await audit(tx, user, "workOrder.task.hours", "workOrderTask", task.id, {
        hours: next,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// TASK PHOTOS — real uploads to object storage.
// =========================================================================

// Shared: validate + store the uploaded image, then push its key onto the task's
// before/result array (+ audit). The caller supplies the multer-parsed file.
async function appendPhoto(
  user: AuthUser,
  workOrderId: string,
  taskId: string,
  field: "beforePhotos" | "resultPhotos",
  scope: "wo-task-before" | "wo-task-result",
  file: Express.Multer.File | undefined,
) {
  const task = await loadTask(workOrderId, taskId);
  const key = await storeUpload(user, file, scope, taskId);
  await prisma.$transaction(async (tx) => {
    await tx.workOrderTask.update({
      where: { id: task.id },
      data: { [field]: { push: key } },
    });
    await audit(tx, user, "workOrder.task.photo.add", "workOrderTask", task.id, {
      field,
      photo: key,
    });
  });
}

// POST /work-orders/:id/tasks/:taskId/photos/before — multipart "file".
workOrdersRouter.post(
  "/:id/tasks/:taskId/photos/before",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    await appendPhoto(
      user,
      req.params.id,
      req.params.taskId,
      "beforePhotos",
      "wo-task-before",
      req.file,
    );
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/photos/result — multipart "file".
workOrdersRouter.post(
  "/:id/tasks/:taskId/photos/result",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    await appendPhoto(
      user,
      req.params.id,
      req.params.taskId,
      "resultPhotos",
      "wo-task-result",
      req.file,
    );
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/tasks/:taskId/photos {photo} — remove from either set.
// `photo` is the stored object key. Purges the object from storage too.
workOrdersRouter.delete(
  "/:id/tasks/:taskId/photos",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = removePhotoSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const existed =
      task.beforePhotos.includes(input.photo) ||
      task.resultPhotos.includes(input.photo);
    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.update({
        where: { id: task.id },
        data: {
          beforePhotos: task.beforePhotos.filter((p) => p !== input.photo),
          resultPhotos: task.resultPhotos.filter((p) => p !== input.photo),
        },
      });
      await audit(tx, user, "workOrder.task.photo.remove", "workOrderTask", task.id, {
        photo: input.photo,
      });
    });
    if (existed) await deleteStored(input.photo);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// WORK-ORDER REQUIREMENTS (operational packing list)
// =========================================================================

// Task materials appear in the packing list directly from TaskMaterial. These
// endpoints manage only the office's extra operational items (tools and loose
// supplies), so they never touch quoted scope or invoice totals.
workOrdersRouter.post(
  "/:id/requirements",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addWorkOrderRequirementSchema.parse(req.body);
    const { project } = await requireQuoteScopeEditor(user, req.params.id);

    await prisma.$transaction(async (tx) => {
      const ordinal = await tx.workOrderRequirement.count({
        where: { workOrderId: req.params.id },
      });
      const item = await tx.workOrderRequirement.create({
        data: {
          workOrderId: req.params.id,
          name: clampText(input.name),
          kind: input.kind,
          quantity: input.quantity !== undefined ? clampNumber(input.quantity) : null,
          unit: input.unit ? clampText(input.unit) : null,
          ordinal,
        },
      });
      await appendActivity(tx, user, project.id, "requirement.added", {
        name: item.name,
      });
      await audit(tx, user, "workOrder.requirement.add", "workOrderRequirement", item.id, input);
    });

    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

workOrdersRouter.patch(
  "/:id/requirements/:requirementId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateWorkOrderRequirementSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
    const item = await prisma.workOrderRequirement.findFirst({
      where: { id: req.params.requirementId, workOrderId: req.params.id },
    });
    if (!item) throw NotFound("Requirement not found");

    await prisma.$transaction(async (tx) => {
      await tx.workOrderRequirement.update({
        where: { id: item.id },
        data: { done: input.done },
      });
      await audit(tx, user, "workOrder.requirement.update", "workOrderRequirement", item.id, input);
    });

    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

workOrdersRouter.delete(
  "/:id/requirements/:requirementId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireQuoteScopeEditor(user, req.params.id);
    const item = await prisma.workOrderRequirement.findFirst({
      where: { id: req.params.requirementId, workOrderId: req.params.id },
    });
    if (!item) throw NotFound("Requirement not found");

    await prisma.$transaction(async (tx) => {
      await tx.workOrderRequirement.delete({ where: { id: item.id } });
      await appendActivity(tx, user, project.id, "requirement.removed", {
        name: item.name,
      });
      await audit(tx, user, "workOrder.requirement.remove", "workOrderRequirement", item.id);
    });

    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// TASK MATERIALS (shared line item)
// =========================================================================

// POST /work-orders/:id/tasks/:taskId/materials/from-article — add a line from
// the ARTICLE catalog (other products & services: labour hours, logistics,
// miscellaneous sales items). Name/unit/unitPrice resolve SERVER-side from the
// org-scoped Article, mirroring from-catalog: a technician's responses strip
// prices, so client-side autofill would create priceless lines.
workOrdersRouter.post(
  "/:id/tasks/:taskId/materials/from-article",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addMaterialFromArticleSchema.parse(req.body);
    const isExtraWork = input.isExtraWork === true;
    // Same gate split as the sibling routes: meerwerk is reportable by
    // technicians; sold scope is office-only.
    const { project } = isExtraWork
      ? await requireWritableWorkOrder(user, req.params.id)
      : await requireQuoteScopeEditor(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true },
    });
    const scope = taskScopeLabel(task, wb.title);

    const article = await prisma.article.findFirst({
      where: { id: input.articleId, orgId: user.orgId },
    });
    if (!article) throw NotFound("Article not found");

    await prisma.$transaction(async (tx) => {
      const count = await tx.taskMaterial.count({ where: { taskId: task.id } });
      const mat = await tx.taskMaterial.create({
        data: {
          taskId: task.id,
          name: article.name,
          quantity:
            input.quantity !== undefined
              ? clampNumber(input.quantity)
              : article.defaultQuantity || 1,
          unit: article.unit,
          unitPrice: article.unitPrice,
          onSite: false,
          ordinal: count,
          isExtraWork,
        },
      });
      await appendActivity(tx, user, project.id, "material.addedTask", {
        scope,
        name: article.name,
      });
      await audit(tx, user, "workOrder.material.addFromArticle", "taskMaterial", mat.id, {
        articleId: article.id,
      });
      await syncTaskDone(tx, task.id);
      await recomputeQuoteAmount(tx, req.params.id);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/materials — add a CUSTOM (free-text) line:
// description + quantity + unit typed by hand, for material that isn't in the
// catalog. Admin-only, like every other quoted-scope write: a new line adds to
// what the customer is invoiced. The monteur's equivalent is meerwerk.
//
// unitPrice is accepted here (admin-only by the route gate, so there is no
// technician path to it) — the office is expected to price a miscellaneous line
// themselves, since there is no variant to resolve it from.
workOrdersRouter.post(
  "/:id/tasks/:taskId/materials",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addMaterialSchema.parse(req.body);
    const isExtraWork = input?.isExtraWork === true;
    // Meerwerk is the technician's path: it never touches the quoted amount
    // (recomputeQuoteAmount skips it) and only bills after office + client
    // approval, so the quote-scope guard doesn't apply to it.
    const { project } = isExtraWork
      ? await requireWritableWorkOrder(user, req.params.id)
      : await requireQuoteScopeEditor(user, req.params.id);
    // A technician never sees prices, so never let them set one — the office
    // prices meerwerk later. (Mirrors the old /extra-work route.)
    const mayPrice = canEditQuoteScope(user.role);
    const task = await loadTask(req.params.id, req.params.taskId);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true },
    });
    const scope = taskScopeLabel(task, wb.title);
    const seeded = input && (input.name !== undefined || input.quantity !== undefined);

    await prisma.$transaction(async (tx) => {
      const count = await tx.taskMaterial.count({ where: { taskId: task.id } });
      const mat = await tx.taskMaterial.create({
        data: {
          taskId: task.id,
          // Blank default mirrors addTaskMaterial: name "", qty 1, unit "meter".
          name: input?.name !== undefined ? clampText(input.name) : "",
          quantity:
            input?.quantity !== undefined ? clampNumber(input.quantity) : 1,
          unit: input?.unit ?? "meter",
          unitPrice: mayPrice ? (input?.unitPrice ?? null) : null,
          diameter: input?.diameter ?? null,
          label: input?.label ? clampText(input.label) : null,
          onSite: false,
          ordinal: count,
          isExtraWork,
        },
      });
      if (seeded) {
        await appendActivity(tx, user, project.id, "material.addedTask", {
          scope,
          name: input?.name ?? "",
        });
      } else {
        await appendActivity(tx, user, project.id, "material.added", { scope });
      }
      await audit(tx, user, "workOrder.material.add", "taskMaterial", mat.id);
      // A new named line can un-complete the zone; keep task.done in sync.
      await syncTaskDone(tx, task.id);
      // unitPrice may have been seeded → keep quote amount in sync.
      await recomputeQuoteAmount(tx, req.params.id);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/materials/from-catalog — add a line from
// the materials catalog. Name/unit/unitPrice/diameter resolve SERVER-side from
// the MaterialVariant: a technician's own API responses strip prices, so
// client-side autofill would create priceless lines. The variant is org-scoped
// via its parent material.
// Admin-only for the same reason as the free-text variant above: a new catalog
// line adds to the quoted amount.
workOrdersRouter.post(
  "/:id/tasks/:taskId/materials/from-catalog",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addMaterialFromCatalogSchema.parse(req.body);
    const isExtraWork = input.isExtraWork === true;
    // See the free-text route above: meerwerk is reportable by technicians
    // because it can't move the quoted amount.
    const { project } = isExtraWork
      ? await requireWritableWorkOrder(user, req.params.id)
      : await requireQuoteScopeEditor(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { title: true },
    });
    const scope = taskScopeLabel(task, wb.title);

    const variant = await prisma.materialVariant.findFirst({
      where: { id: input.variantId, material: { orgId: user.orgId } },
      include: { material: true },
    });
    if (!variant) throw NotFound("Material variant not found");

    // Werkbon lines are the org's business data — compose the description in
    // the org's document locale (nl) from the English-keyed label maps.
    const name = buildMaterialLineName(variant.material, variant, "nl");
    const unit = LINE_UNIT_LABELS[variant.unit]?.nl ?? variant.unit;

    await prisma.$transaction(async (tx) => {
      const count = await tx.taskMaterial.count({ where: { taskId: task.id } });
      const mat = await tx.taskMaterial.create({
        data: {
          taskId: task.id,
          name,
          quantity: input.quantity !== undefined ? clampNumber(input.quantity) : 1,
          unit,
          unitPrice: variant.unitPrice,
          // Snapshot the cost too, so admin margin stays stable if catalog cost
          // later changes. Null when the variant has no cost set yet.
          costPrice: variant.costPrice,
          diameter: parseDiameter(variant.material, variant),
          variantId: variant.id,
          onSite: false,
          ordinal: count,
          isExtraWork,
        },
      });
      await appendActivity(tx, user, project.id, "material.addedTask", {
        scope,
        name,
      });
      await audit(tx, user, "workOrder.material.addFromCatalog", "taskMaterial", mat.id, {
        variantId: variant.id,
      });
      // New (not-done) line → the zone is no longer complete.
      await syncTaskDone(tx, task.id);
      await recomputeQuoteAmount(tx, req.params.id);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// PATCH /work-orders/:id/materials/:matId — update a line item.
//
// FIELD-LEVEL role split, same rule as PATCH /tasks/:taskId:
//   technician → usedQuantity, onSite, done, note   (what happened on site)
//   admin      → + name, unit, quantity, unitPrice, diameter, label, variantId
// The admin-only set is the invoice line itself: quantity and unitPrice feed
// recomputeQuoteAmount() directly, and name/variant decide WHAT was billed. A
// monteur who needs more material reports meerwerk; the office prices it.
const MATERIAL_SCOPE_FIELDS = [
  "name",
  "unit",
  "quantity",
  "unitPrice",
  "diameter",
  "label",
  "variantId",
] as const;

workOrdersRouter.patch(
  "/:id/materials/:matId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateMaterialSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);

    if (!canEditQuoteScope(user.role)) {
      const attempted = MATERIAL_SCOPE_FIELDS.filter((f) => input[f] !== undefined);
      if (attempted.length > 0) {
        throw Forbidden(
          `Only the office can change the quoted line (${attempted.join(", ")}). Report extra work instead.`,
        );
      }
      // Re-classifying a line moves money between the quoted amount and the
      // meerwerk bucket — office only.
      if (input.isExtraWork !== undefined) {
        throw Forbidden("Only the office can change whether a line is meerwerk.");
      }
    }

    const before = await loadMaterial(req.params.id, req.params.matId);

    // Repointing at a catalog variant: re-resolve name/unit/price/cost/diameter
    // SERVER-side. Client-supplied name/unit/unitPrice/diameter are ignored for
    // these fields — the variant is the source of truth (a technician's request
    // must never set a price). variantId === null clears the catalog link but
    // leaves the current values (free-text line).
    let variantResolved:
      | { name: string; unit: string; unitPrice: number; costPrice: number | null; diameter: number | null; variantId: string }
      | undefined;
    if (input.variantId) {
      const variant = await prisma.materialVariant.findFirst({
        where: { id: input.variantId, material: { orgId: user.orgId } },
        include: { material: true },
      });
      if (!variant) throw NotFound("Material variant not found");
      variantResolved = {
        name: buildMaterialLineName(variant.material, variant, "nl"),
        unit: LINE_UNIT_LABELS[variant.unit]?.nl ?? variant.unit,
        unitPrice: variant.unitPrice,
        costPrice: variant.costPrice,
        diameter: parseDiameter(variant.material, variant),
        variantId: variant.id,
      };
    }

    // Changing WHAT is being agreed invalidates any approval already given, so
    // both sides must re-approve. Only the fields that define the line (and its
    // price) count — ticking `done`/`onSite`/`note` or recording usage doesn't
    // change the deal. Applies to meerwerk lines only; the rest ignore these
    // columns entirely.
    const AGREEMENT_FIELDS = [...MATERIAL_SCOPE_FIELDS] as const;
    const agreementChanged =
      before.isExtraWork && AGREEMENT_FIELDS.some((f) => input[f] !== undefined);

    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: before.id },
        data: {
          ...(input.isExtraWork !== undefined ? { isExtraWork: input.isExtraWork } : {}),
          ...(agreementChanged
            ? { approvedByOffice: false, approvedByClient: false, rejected: false, rejectedBy: null }
            : {}),
          // Variant switch wins over any client-supplied name/unit/price/diameter.
          ...(variantResolved
            ? {
                variantId: variantResolved.variantId,
                name: variantResolved.name,
                unit: variantResolved.unit,
                unitPrice: variantResolved.unitPrice,
                costPrice: variantResolved.costPrice,
                diameter: variantResolved.diameter,
              }
            : {
                ...(input.variantId === null ? { variantId: null } : {}),
                name: input.name !== undefined ? clampText(input.name) : undefined,
                unit: input.unit !== undefined ? input.unit : undefined,
                diameter: input.diameter !== undefined ? input.diameter : undefined,
                unitPrice: input.unitPrice !== undefined ? input.unitPrice : undefined,
              }),
          label: input.label !== undefined ? input.label : undefined,
          quantity:
            input.quantity !== undefined
              ? clampNumber(input.quantity)
              : undefined,
          usedQuantity:
            input.usedQuantity !== undefined
              ? input.usedQuantity === null
                ? null
                : clampNumber(input.usedQuantity)
              : undefined,
          onSite: input.onSite !== undefined ? input.onSite : undefined,
          requirementDone:
            input.requirementDone !== undefined ? input.requirementDone : undefined,
          done: input.done !== undefined ? input.done : undefined,
          note:
            input.note !== undefined
              ? input.note === null
                ? null
                : clampText(input.note)
              : undefined,
        },
      });
      if (input.name !== undefined && clampText(input.name) !== before.name) {
        await appendActivity(tx, user, project.id, "material.renamed", {
          from: before.name || "—",
          to: clampText(input.name) || "—",
        });
      }
      if (input.quantity !== undefined && input.quantity !== before.quantity) {
        await appendActivity(tx, user, project.id, "material.quantityChanged", {
          name: before.name || "—",
          from: before.quantity,
          to: input.quantity,
          unit: before.unit,
        });
      }
      await audit(tx, user, "workOrder.material.update", "taskMaterial", before.id, input);
      // `done` may have flipped → keep the parent zone's done in sync.
      if (input.done !== undefined) await syncTaskDone(tx, before.taskId);
      // qty/price may have changed → recompute quote amount.
      await recomputeQuoteAmount(tx, req.params.id);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/materials/:matId — remove a line item. Admin-only:
// deleting a quoted line silently reduces the invoice. A monteur who didn't
// need the material sets usedQuantity 0 (or leaves it not-done) instead, which
// records the fact without rewriting what was sold.
workOrdersRouter.delete(
  "/:id/materials/:matId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireQuoteScopeEditor(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.delete({ where: { id: before.id } });
      await appendActivity(tx, user, project.id, "material.removed", {
        name: before.name || "—",
      });
      await audit(tx, user, "workOrder.material.remove", "taskMaterial", before.id);
      // Removing a line can complete the zone (all remaining named lines done).
      await syncTaskDone(tx, before.taskId);
      await recomputeQuoteAmount(tx, req.params.id);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/usage {used?, issued?, returned?} —
// register stock on the line: what was handed out to the monteur, what was
// actually used, what came back. Unaccounted = issued − used − returned,
// derived at read time (never stored).
workOrdersRouter.post(
  "/:id/materials/:matId/usage",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = usageSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    const used = input.used !== undefined ? clampNumber(input.used) : undefined;
    const issued = input.issued !== undefined ? clampNumber(input.issued) : undefined;
    const returned = input.returned !== undefined ? clampNumber(input.returned) : undefined;
    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: before.id },
        data: {
          usedQuantity: used,
          issuedQuantity: issued,
          returnedQuantity: returned,
        },
      });
      if (used !== undefined && (before.usedQuantity ?? 0) !== used) {
        const diff = used - before.quantity;
        await appendActivity(tx, user, project.id, "material.usageChanged", {
          name: before.name || "—",
          from: before.usedQuantity ?? 0,
          to: used,
          unit: before.unit,
          // Over/under-plan note, keyed so the client renders it; "" when on plan.
          deltaKind: diff > 0 ? "over" : diff < 0 ? "under" : "none",
          delta: Math.abs(diff),
        });
      }
      await audit(tx, user, "workOrder.material.usage", "taskMaterial", before.id, {
        used,
        issued,
        returned,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/progress {amount, day?} — log one
// day's progress on the line, in the line's unit ("Monday 10 of the 100 m").
// Registration, so technicians may log (dispatch-gated). Records WHO (the
// caller's employee) and WHICH DAY. Reaching the line's target quantity marks
// the line done, which can complete the zone via syncTaskDone.
workOrdersRouter.post(
  "/:id/materials/:matId/progress",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = progressSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    const day = input.day ?? new Date().toISOString().slice(0, 10);
    const amount = clampNumber(input.amount);

    await prisma.$transaction(async (tx) => {
      await tx.taskProgressEntry.create({
        data: {
          materialId: before.id,
          employeeId: user.employeeId ?? null,
          amount,
          day,
        },
      });
      const sum = await tx.taskProgressEntry.aggregate({
        where: { materialId: before.id },
        _sum: { amount: true },
      });
      const total = sum._sum.amount ?? 0;
      // Target reached → the line is done (same effect as ticking it off).
      if (!before.done && before.quantity > 0 && total >= before.quantity) {
        await tx.taskMaterial.update({ where: { id: before.id }, data: { done: true } });
      }
      await appendActivity(tx, user, project.id, "material.progressLogged", {
        name: before.name || "—",
        amount,
        total,
        target: before.quantity,
        unit: before.unit,
      });
      await audit(tx, user, "workOrder.material.progress", "taskMaterial", before.id, {
        amount,
        day,
      });
      await syncTaskDone(tx, before.taskId);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/materials/:matId/progress/:entryId — correction path
// (a mistyped amount). Office only: silently rewriting a monteur's log is an
// office decision, and the audit row keeps the trace.
workOrdersRouter.delete(
  "/:id/materials/:matId/progress/:entryId",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    const entry = await prisma.taskProgressEntry.findFirst({
      where: { id: req.params.entryId, materialId: before.id },
    });
    if (!entry) throw NotFound("Progress entry not found");
    await prisma.$transaction(async (tx) => {
      await tx.taskProgressEntry.delete({ where: { id: entry.id } });
      await audit(tx, user, "workOrder.material.progress.remove", "taskMaterial", before.id, {
        amount: entry.amount,
        day: entry.day,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/toggle — flip material.done.
workOrdersRouter.post(
  "/:id/materials/:matId/toggle",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: before.id },
        data: { done: !before.done },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        before.done ? "task.toggledReopened" : "task.toggledDone",
        { name: before.label || before.name || "—" },
      );
      await audit(tx, user, "workOrder.material.toggle", "taskMaterial", before.id, {
        done: !before.done,
      });
      // A line's done drives its zone's done (and thus the work-order status).
      await syncTaskDone(tx, before.taskId);
      await recomputeWorkOrderStatus(tx, req.params.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// COMPLETION
// =========================================================================

// Mark this work order's open tasks and its named materials done. Returns the
// count of tasks newly flipped. Caller wraps in a tx.
async function completeWorkOrderTasks(
  tx: Tx,
  workOrderId: string,
): Promise<number> {
  const openTasks = await tx.workOrderTask.findMany({
    where: { workOrderId, done: false },
    select: { id: true },
  });
  if (openTasks.length > 0) {
    await tx.workOrderTask.updateMany({
      where: { id: { in: openTasks.map((t) => t.id) } },
      data: { done: true },
    });
  }
  await tx.taskMaterial.updateMany({
    where: {
      task: { workOrderId },
      done: false,
      NOT: { name: "" },
    },
    data: { done: true },
  });
  return openTasks.length;
}

// POST /work-orders/:id/complete-all — mark this work order's tasks/materials done.
workOrdersRouter.post(
  "/:id/complete-all",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { workOrder, project } = await requireWritableWorkOrder(
      user,
      req.params.id,
    );
    await prisma.$transaction(async (tx) => {
      const changed = await completeWorkOrderTasks(tx, workOrder.id);
      if (changed > 0) {
        await appendActivity(tx, user, project.id, "task.completedAll", {
          count: changed,
        });
      }
      await audit(tx, user, "workOrder.complete-all", "workOrder", workOrder.id, {
        changed,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/finish — sign off THIS work order with a drawn signature
// image (multipart "file") + the signer's typed name ("signedByName"). Completes
// its own tasks/materials, stores the signature object key + name + signedAt +
// signer. Locks only this work order; siblings and the project stage are untouched.
workOrdersRouter.post(
  "/:id/finish",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const signedByName = clampText(String(req.body?.signedByName ?? "")).trim();
    if (!signedByName) throw BadRequest("Signer name is required");
    const { workOrder, project } = await requireWritableWorkOrder(
      user,
      req.params.id,
    );
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: workOrder.id },
      select: { title: true, signedAt: true, ordinal: true },
    });
    if (wb.signedAt) throw BadRequest("Work order is already signed off");

    // Store the drawn signature image (PNG) before opening the transaction.
    const signatureKey = await storeSignature(user, req.file, workOrder.id);

    await prisma.$transaction(async (tx) => {
      await completeWorkOrderTasks(tx, workOrder.id);
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          signature: signatureKey,
          signedByName,
          signedAt: new Date(),
          signedById: user.id,
          statusOverride: null,
        },
      });
      await appendActivity(tx, user, project.id, "workOrder.signed", {
        title: wb.title || `#${wb.ordinal + 1}`,
      });
      await audit(tx, user, "workOrder.finish", "workOrder", workOrder.id, {
        signedByName,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/reopen — undo a sign-off. admin-only: finishing captures
// a customer signature (a business/legal record), so unlocking it back to
// editable is an office decision, not something a technician self-serves.
// Clears signature/signedAt/signedByName; does NOT revert the task/material
// "done" flags that /finish force-completed (no record of which were already
// done vs. force-completed, and re-opening for a correction shouldn't silently
// un-tick genuinely finished work).
workOrdersRouter.post(
  "/:id/reopen",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { workOrder, project } = await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: workOrder.id },
      select: { title: true, signedAt: true, signature: true, ordinal: true },
    });
    if (!wb.signedAt) throw BadRequest("Work order is not signed off");

    const signatureKey = wb.signature;
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: {
          signature: null,
          signedByName: null,
          signedAt: null,
          signedById: null,
          statusOverride: null,
        },
      });
      await appendActivity(tx, user, project.id, "workOrder.reopened", {
        title: wb.title || `#${wb.ordinal + 1}`,
      });
      await audit(tx, user, "workOrder.reopen", "workOrder", workOrder.id);
    });
    if (signatureKey) await deleteStored(signatureKey);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// MEERWERK (extra work) approval — a TaskMaterial line with `isExtraWork`.
//
// Meerwerk is no longer its own entity: it's an ordinary priced line inside a
// zone, flagged. The flag changes only WHEN it counts as money — never in the
// werkbon value / quote (that's the sold scope, see recomputeQuoteAmount), and
// on the invoice only once BOTH office and client approve (see deriveTotals in
// invoices/routes.ts). Those two pools stay disjoint, so a line is never billed
// twice. Creating/editing meerwerk goes through the normal material routes.
// =========================================================================

// Load a meerwerk line scoped to THIS work order (:id), enforcing visibility via
// the loaded werkbon. 404s for a line that isn't meerwerk — the approval routes
// must never touch a sold line.
async function loadMeerwerk(user: AuthUser, workOrderId: string, matId: string) {
  const loaded = await loadProjectForWorkOrder(user, workOrderId);
  const item = await prisma.taskMaterial.findFirst({
    where: { id: matId, isExtraWork: true, task: { workOrderId } },
  });
  if (!item) throw NotFound("Extra work not found");
  return { ...loaded, item };
}

// The label used in the activity feed for a meerwerk line.
const meerwerkLabel = (item: { label: string | null; name: string }) =>
  item.label?.trim() || item.name || "—";

// POST /work-orders/:id/materials/:matId/approve-office — admin. Toggle.
workOrdersRouter.post(
  "/:id/materials/:matId/approve-office",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.matId);
    const next = !item.approvedByOffice;

    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: item.id },
        data: { approvedByOffice: next, rejected: false, rejectedBy: null },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        next ? "extraWork.officeApproved" : "extraWork.officeWithdrawn",
        { description: meerwerkLabel(item) },
      );
      await audit(tx, user, "workOrder.extraWork.approveOffice", "taskMaterial", item.id);
    });

    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/approve-client — the office (recording
// an approval given by phone/mail) OR the client who owns this project. Toggle.
// This is the client's only approval touchpoint.
workOrdersRouter.post(
  "/:id/materials/:matId/approve-client",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.matId);
    if (!canApproveAsOffice(user.role)) {
      if (user.role !== "client" || project.customerId !== user.customerId) {
        throw Forbidden("Not allowed to approve this extra work");
      }
    }
    const next = !item.approvedByClient;

    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: item.id },
        data: { approvedByClient: next, rejected: false, rejectedBy: null },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        next ? "extraWork.clientApproved" : "extraWork.clientWithdrawn",
        { description: meerwerkLabel(item) },
      );
      await audit(tx, user, "workOrder.extraWork.approveClient", "taskMaterial", item.id);
    });

    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/reject — admin. {by?}.
workOrdersRouter.post(
  "/:id/materials/:matId/reject",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { by } = rejectMeerwerkSchema.parse(req.body);
    const rejectedBy = by ?? "office";
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.matId);

    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: item.id },
        data: {
          rejected: true,
          rejectedBy,
          approvedByOffice: false,
          approvedByClient: false,
        },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        rejectedBy === "client" ? "extraWork.rejectedByClient" : "extraWork.rejectedByOffice",
        { description: meerwerkLabel(item) },
      );
      await audit(tx, user, "workOrder.extraWork.reject", "taskMaterial", item.id);
    });

    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/photo — photo evidence for meerwerk.
workOrdersRouter.post(
  "/:id/materials/:matId/photo",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const { item } = await loadMeerwerk(user, req.params.id, req.params.matId);
    const key = await storeUpload(user, req.file, "extra-work", item.id);

    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: item.id },
        data: { photos: { push: key } },
      });
      await audit(tx, user, "workOrder.extraWork.photo", "taskMaterial", item.id, { photo: key });
    });

    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/materials/:matId/photo {photo} — remove a photo by key.
workOrdersRouter.delete(
  "/:id/materials/:matId/photo",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const { photo } = removePhotoSchema.parse(req.body);
    const { item } = await loadMeerwerk(user, req.params.id, req.params.matId);
    if (!item.photos.includes(photo)) throw NotFound("Photo not found");

    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: item.id },
        data: { photos: item.photos.filter((p) => p !== photo) },
      });
      await audit(tx, user, "workOrder.extraWork.photo.remove", "taskMaterial", item.id, {
        photo,
      });
    });
    await deleteStored(photo);
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);
