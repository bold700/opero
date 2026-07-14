import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  type UserRole,
  PREJOB_CHECK_ITEMS,
  type PrejobCheckItem,
  normalizePrejobCheck,
  canDispatch,
  canSeePrices,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { resolveHidePrices } from "../../lib/orgPricing.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { storeUpload, deleteStored, storeSignature } from "../../lib/attachUpload.js";
import { uploadSingle } from "../../lib/upload.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import type { AuthUser } from "../../auth/types.js";
import { canViewProject } from "../projects/visibility.js";
import {
  workOrderDto,
  workOrderInclude,
  workOrderListDto,
  workOrderListInclude,
  type WorkOrderWithRelations,
} from "./dto.js";
import { recomputeWorkOrderStatus } from "./status.js";
import { buildWorkOrderPdf, type WorkOrderPdfData } from "./pdf.js";
import { buildQuotePdf, type QuotePdfData } from "./quote-pdf.js";
import { buildMaterialLineName, parseDiameter, LINE_UNIT_LABELS } from "../materials/labels.js";
import {
  addMaterialFromCatalogSchema,
  addMaterialSchema,
  createWorkOrderSchema,
  prejobCheckSchema,
  removePhotoSchema,
  reorderTasksSchema,
  taskHoursSchema,
  updateMaterialSchema,
  updateTaskSchema,
  updateWorkOrderSchema,
  usageSchema,
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
async function recomputeQuoteAmount(tx: Tx, projectId: string): Promise<void> {
  const materials = await tx.taskMaterial.findMany({
    where: { task: { workOrder: { projectId } } },
    select: { quantity: true, unitPrice: true },
  });
  const value = materials.reduce(
    (sum, m) => sum + m.quantity * (m.unitPrice ?? 0),
    0,
  );
  if (value > 0) {
    await tx.project.update({ where: { id: projectId }, data: { value } });
  }
}

// Load a workOrder + its project, enforce visibility, return write-ability.
//
// VISIBILITY / GUARD MODEL:
// - admin:      canView always; canWrite always.
// - technician: canView/canWrite ONLY for projects they're assigned to
//               (teamLeaderId / projectLeaderId / installers includes employeeId).
// - client:     canView only for their own customer's projects; canWrite never.
// Not visible → 404 (don't leak existence).
async function loadProjectForWorkOrder(
  user: AuthUser,
  workOrderId: string,
): Promise<{
  workOrder: { id: string; projectId: string };
  project: ProjectForGuard;
  canWrite: boolean;
}> {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, project: { orgId: user.orgId, deletedAt: null } },
    select: {
      id: true,
      projectId: true,
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
  if (!workOrder || !canViewProject(user, workOrder.project)) {
    throw NotFound("Work order not found");
  }
  const canWrite =
    user.role === "admin" ||
    (user.role === "technician" && canViewProject(user, workOrder.project));
  return {
    workOrder: { id: workOrder.id, projectId: workOrder.projectId },
    project: workOrder.project,
    canWrite,
  };
}

// Guard for any write op: load + assert canWrite, else 403.
async function requireWritableWorkOrder(user: AuthUser, workOrderId: string) {
  const loaded = await loadProjectForWorkOrder(user, workOrderId);
  if (!loaded.canWrite) throw Forbidden("Not allowed to modify this work order");
  return loaded;
}

// Reload + serialize a workOrder (role-aware DTO with price-stripping).
async function reloadWorkOrder(user: AuthUser, workOrderId: string) {
  // Every mutating work-order route funnels through here on its way to the
  // response, so recomputing the denormalized listStatus here keeps it in sync
  // after ANY change (task toggle/start/end, completion, material edits) without
  // dotting the call across ~10 transaction sites. Runs post-commit on `prisma`.
  await recomputeWorkOrderStatus(prisma, workOrderId);
  const wb = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: workOrderInclude,
  });
  if (!wb) throw NotFound("Work order not found");
  const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
  return await workOrderDto(wb as WorkOrderWithRelations, user.role as UserRole, hidePrices);
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
const WORK_ORDER_STATUSES = ["open", "on_the_way", "urgent", "done"] as const;

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

    // Build a project filter that bakes in org + visibility. For
    // technician/client this restricts to assigned/own projects; admin sees all.
    const projectWhere: Prisma.ProjectWhereInput = {
      orgId: user.orgId,
      deletedAt: null,
      ...(projectId ? { id: projectId } : {}),
    };
    if (user.role === "client") {
      projectWhere.customerId = user.customerId ?? "__none__";
    } else if (user.role === "technician") {
      const employeeId = user.employeeId ?? "__none__";
      projectWhere.OR = [
        { teamLeaderId: employeeId },
        { projectLeaderId: employeeId },
        { installers: { some: { id: employeeId } } },
      ];
    }

    // Base visibility filter (shared by counts + the page query). Search matches
    // the same project fields the global search does (number/customer/city/title).
    const baseWhere: Prisma.WorkOrderWhereInput = { project: projectWhere };
    if (search) {
      const ci = { contains: search, mode: "insensitive" as const };
      baseWhere.OR = [
        { title: ci },
        { project: { is: { projectNumber: ci } } },
        { project: { is: { customerName: ci } } },
        { project: { is: { city: ci } } },
      ];
    }

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

// GET /work-orders/assignable — field staff {id, name} for per-task assignment.
// Readable by admin + technician (the employees list is admin-only, but
// technicians assign tasks on the detail screen). Must precede "/:id".
workOrdersRouter.get(
  "/assignable",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role === "client") throw Forbidden("Not allowed");
    const rows = await prisma.employee.findMany({
      where: { orgId: user.orgId, deletedAt: null, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(rows);
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
            urgency: true,
            customer: { select: { contactName: true } },
          },
        },
      },
    });
    if (!wb) throw NotFound("Work order not found");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.orgId },
    });
    const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
    const showPrices = canSeePrices(user.role as UserRole, hidePrices);

    const sortedTasks = [...wb.tasks].sort((a, b) => a.ordinal - b.ordinal);
    const pdfData: WorkOrderPdfData = {
      number: wb.project.projectNumber,
      ordinal: wb.ordinal,
      title: wb.title,
      status: wb.listStatus,
      createdAt: wb.createdAt,
      customer: {
        name: wb.project.customerName,
        contactName: wb.project.customer?.contactName || undefined,
        address: wb.project.address || undefined,
        postalCode: wb.project.postalCode || undefined,
        city: wb.project.city || undefined,
      },
      insulationType: wb.project.insulationType || undefined,
      tasks: sortedTasks.map((t) => ({
        description: t.description,
        workTypeName: t.workType?.name ?? undefined,
        assigneeName: t.assignee?.name ?? undefined,
        done: t.done,
        hours: t.hours,
        materials: [...t.materials]
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((m) => ({
            name: m.name,
            quantity: m.quantity,
            unit: m.unit,
            unitPrice: showPrices ? m.unitPrice : null,
          })),
        beforePhotos: t.beforePhotos,
        resultPhotos: t.resultPhotos,
      })),
      prejobCheck: normalizePrejobCheck(wb.prejobCheck) as Record<string, boolean>,
      prejobPhotos: wb.prejobPhotos,
      dispatchedAt: wb.dispatchedAt,
      signature: wb.signature,
      signedByName: wb.signedByName ?? wb.signedBy?.name ?? undefined,
      signedAt: wb.signedAt,
    };

    const filename = `werkbon-${wb.project.projectNumber}-${wb.ordinal + 1}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await buildWorkOrderPdf(pdfData, { showPrices, org }, res);
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
  requireRole("admin"),
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
        contactName: wb.project.customer?.contactName || undefined,
        address: wb.project.address || undefined,
        postalCode: wb.project.postalCode || undefined,
        city: wb.project.city || undefined,
      },
      groups: sortedTasks.map((t) => ({
        heading: t.description,
        lines: [...t.materials]
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
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// WORK ORDER CRUD
// =========================================================================

// POST /work-orders {projectId, title?} — create. Admin only: setting up a
// werkbon (customer + project context) is an office task. Technicians are
// ASSIGNED werkbons and fill them in (tasks/photos/signature) via the write
// endpoints below — they don't create. See docs/roles-and-permissions.md.
workOrdersRouter.post(
  "/",
  requireRole("admin"),
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

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.workOrder.count({
        where: { projectId: project.id },
      });
      const wb = await tx.workOrder.create({
        data: {
          projectId: project.id,
          // Empty title → the client renders a translated fallback that includes
          // the 1-based index. No display prose stored in the DB.
          title: input.title?.trim() ?? "",
          drawings: [],
          ordinal: count,
        },
        include: workOrderInclude,
      });
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
    const hidePrices = await resolveHidePrices(user.role as UserRole, user.orgId);
    res
      .status(201)
      .json(await workOrderDto(created as WorkOrderWithRelations, user.role as UserRole, hidePrices));
  }),
);

// PATCH /work-orders/:id {title?} — admin only.
workOrdersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateWorkOrderSchema.parse(req.body);
    await loadProjectForWorkOrder(user, req.params.id); // visibility (404 if not)
    if (user.role !== "admin") throw Forbidden("Admin only");
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: {
          title: input.title !== undefined ? clampText(input.title) : undefined,
        },
      });
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
    if (user.role !== "admin") throw Forbidden("Admin only");
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
      // Materials gone → keep quote amount in sync.
      await recomputeQuoteAmount(tx, project.id);
    });
    res.status(204).end();
  }),
);

// POST /work-orders/:id/approve — toggle approvedBySupervisor. admin only.
workOrdersRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await loadProjectForWorkOrder(user, req.params.id);
    if (user.role !== "admin") throw Forbidden("Admin only");
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { approvedBySupervisor: true, title: true, ordinal: true },
    });
    const next = !wb.approvedBySupervisor;
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { approvedBySupervisor: next },
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

// =========================================================================
// PRE-JOB CHECK + DISPATCH GATE
// A monteur may not be dispatched until the pre-job checklist is complete AND
// at least one pre-job photo is attached.
// =========================================================================

// PATCH /work-orders/:id/prejob-check {key, done} — set one checklist item.
workOrdersRouter.patch(
  "/:id/prejob-check",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { key, done } = prejobCheckSchema.parse(req.body);
    if (!(PREJOB_CHECK_ITEMS as readonly string[]).includes(key)) {
      throw BadRequest("Unknown pre-job checklist item");
    }
    await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { prejobCheck: true, dispatchedAt: true },
    });
    if (wb.dispatchedAt) throw BadRequest("Work order is already dispatched");
    const next = normalizePrejobCheck(wb.prejobCheck);
    if (done) next[key as PrejobCheckItem] = true;
    else delete next[key as PrejobCheckItem];
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { prejobCheck: next },
      });
      await audit(tx, user, "workOrder.prejob.check", "workOrder", req.params.id, {
        key,
        done,
      });
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
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { prejobCheck: true, prejobPhotos: true, dispatchedAt: true, title: true, ordinal: true },
    });
    if (wb.dispatchedAt) throw BadRequest("Work order is already dispatched");
    if (!canDispatch(normalizePrejobCheck(wb.prejobCheck), wb.prejobPhotos.length)) {
      throw BadRequest("Pre-job check incomplete: complete the checklist and add at least one photo");
    }
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { dispatchedAt: new Date(), dispatchedById: user.id },
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

// POST /work-orders/:id/tasks — add a blank task (zone). admin + technician.
workOrdersRouter.post(
  "/:id/tasks",
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
workOrdersRouter.patch(
  "/:id/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateTaskSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
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

// DELETE /work-orders/:id/tasks/:taskId — remove a zone.
workOrdersRouter.delete(
  "/:id/tasks/:taskId",
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
      await recomputeQuoteAmount(tx, project.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/reorder — move activeTaskId to overTaskId's slot.
workOrdersRouter.post(
  "/:id/tasks/reorder",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = reorderTasksSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
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
        data: { endedAt, done: true, hours: hours ?? null },
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
        data: { hours: next },
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
// TASK MATERIALS (shared line item)
// =========================================================================

// POST /work-orders/:id/tasks/:taskId/materials — add blank OR seeded line.
workOrdersRouter.post(
  "/:id/tasks/:taskId/materials",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addMaterialSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
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
          unitPrice: input?.unitPrice ?? null,
          diameter: input?.diameter ?? null,
          label: input?.label ? clampText(input.label) : null,
          onSite: false,
          ordinal: count,
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
      // unitPrice may have been seeded → keep quote amount in sync.
      await recomputeQuoteAmount(tx, project.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/materials/from-catalog — add a line from
// the materials catalog. Name/unit/unitPrice/diameter resolve SERVER-side from
// the MaterialVariant: a technician's own API responses strip prices, so
// client-side autofill would create priceless lines. The variant is org-scoped
// via its parent material.
workOrdersRouter.post(
  "/:id/tasks/:taskId/materials/from-catalog",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addMaterialFromCatalogSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
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
          diameter: parseDiameter(variant.material, variant),
          variantId: variant.id,
          onSite: false,
          ordinal: count,
        },
      });
      await appendActivity(tx, user, project.id, "material.addedTask", {
        scope,
        name,
      });
      await audit(tx, user, "workOrder.material.addFromCatalog", "taskMaterial", mat.id, {
        variantId: variant.id,
      });
      await recomputeQuoteAmount(tx, project.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// PATCH /work-orders/:id/materials/:matId — update a line item.
workOrdersRouter.patch(
  "/:id/materials/:matId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateMaterialSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: before.id },
        data: {
          label: input.label !== undefined ? input.label : undefined,
          name: input.name !== undefined ? clampText(input.name) : undefined,
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
          unit: input.unit !== undefined ? input.unit : undefined,
          diameter: input.diameter !== undefined ? input.diameter : undefined,
          unitPrice: input.unitPrice !== undefined ? input.unitPrice : undefined,
          onSite: input.onSite !== undefined ? input.onSite : undefined,
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
      // qty/price may have changed → recompute quote amount.
      await recomputeQuoteAmount(tx, project.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/materials/:matId — remove a line item.
workOrdersRouter.delete(
  "/:id/materials/:matId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.delete({ where: { id: before.id } });
      await appendActivity(tx, user, project.id, "material.removed", {
        name: before.name || "—",
      });
      await audit(tx, user, "workOrder.material.remove", "taskMaterial", before.id);
      await recomputeQuoteAmount(tx, project.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/materials/:matId/usage {used} — set usedQuantity.
workOrdersRouter.post(
  "/:id/materials/:matId/usage",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = usageSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    const before = await loadMaterial(req.params.id, req.params.matId);
    const used = clampNumber(input.used);
    await prisma.$transaction(async (tx) => {
      await tx.taskMaterial.update({
        where: { id: before.id },
        data: { usedQuantity: used },
      });
      if ((before.usedQuantity ?? 0) !== used) {
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
