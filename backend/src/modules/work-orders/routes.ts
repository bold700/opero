import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { canSeePrices, statusForStage, type UserRole } from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth } from "../../auth/middleware.js";
import type { AuthUser } from "../../auth/types.js";
import { canViewProject } from "../projects/visibility.js";
import {
  workOrderDto,
  workOrderInclude,
  type WorkOrderWithRelations,
} from "./dto.js";
import {
  addMaterialSchema,
  createWorkOrderSchema,
  finishSchema,
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

// Append a ProjectActivity "system" row inside a transaction (mirrors the
// store's logChange → makeActivity for the major events).
async function appendActivity(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  body: string,
): Promise<void> {
  await tx.projectActivity.create({
    data: { projectId, userId: user.id, type: "system", body },
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
  const wb = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: workOrderInclude,
  });
  if (!wb) throw NotFound("Work order not found");
  return workOrderDto(wb as WorkOrderWithRelations, user.role as UserRole);
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
  return task?.description?.trim() || workOrderTitle || "Werkbon";
}

// =========================================================================
// LIST + DETAIL
// =========================================================================

// GET /work-orders?projectId= — list (visibility-filtered). If projectId is
// given, only that (visible) project's workOrders.
workOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;

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

    const rows = await prisma.workOrder.findMany({
      where: { project: projectWhere },
      include: workOrderInclude,
      orderBy: [{ projectId: "asc" }, { ordinal: "asc" }, { createdAt: "asc" }],
    });
    res.json(
      rows.map((wb) =>
        workOrderDto(wb as WorkOrderWithRelations, user.role as UserRole),
      ),
    );
  }),
);

// GET /work-orders/:id — one workOrder, full nested, role-aware DTO.
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

// POST /work-orders {projectId, title?} — create. admin OR technician-assigned
// (ensureWorkOrder is operational, not financial). client: 403.
workOrdersRouter.post(
  "/",
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
    if (!project || !canViewProject(user, project)) {
      throw NotFound("Project not found");
    }
    const canWrite =
      user.role === "admin" ||
      (user.role === "technician" && canViewProject(user, project));
    if (!canWrite) throw Forbidden("Not allowed to create work orders here");

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.workOrder.count({
        where: { projectId: project.id },
      });
      const wb = await tx.workOrder.create({
        data: {
          projectId: project.id,
          title: input.title?.trim() || `Werkbon ${count + 1}`,
          drawings: [],
          ordinal: count,
        },
        include: workOrderInclude,
      });
      await audit(tx, user, "workOrder.create", "workOrder", wb.id, {
        projectId: project.id,
      });
      return wb;
    });
    res
      .status(201)
      .json(workOrderDto(created as WorkOrderWithRelations, user.role as UserRole));
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
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.delete({ where: { id: req.params.id } });
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
    await loadProjectForWorkOrder(user, req.params.id);
    if (user.role !== "admin") throw Forbidden("Admin only");
    const wb = await prisma.workOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      select: { approvedBySupervisor: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { approvedBySupervisor: !wb.approvedBySupervisor },
      });
      await audit(tx, user, "workOrder.approve", "workOrder", req.params.id, {
        approvedBySupervisor: !wb.approvedBySupervisor,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/drawings — append a drawing placeholder. admin or
// technician-assigned. TODO(Phase 7): replace placeholder with real upload.
workOrdersRouter.post(
  "/:id/drawings",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    const placeholder = `tekening-${Date.now()}.pdf`; // TODO(Phase 7) real upload
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { drawings: { push: placeholder } },
      });
      await audit(tx, user, "workOrder.drawing.add", "workOrder", req.params.id, {
        drawing: placeholder,
      });
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
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
      await appendActivity(tx, user, project.id, "Zone toegevoegd");
      await audit(tx, user, "workOrder.task.add", "workOrderTask", task.id);
    });
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// PATCH /work-orders/:id/tasks/:taskId — update description/day/done/note.
workOrdersRouter.patch(
  "/:id/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateTaskSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
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
      await appendActivity(tx, user, project.id, `Zone verwijderd: ${scope}`);
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
        await appendActivity(tx, user, project.id, "Zones opnieuw geordend");
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
    await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
    await prisma.$transaction(async (tx) => {
      await tx.workOrderTask.update({
        where: { id: task.id },
        data: { done: !task.done },
      });
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
        await appendActivity(
          tx,
          user,
          project.id,
          `${taskScopeLabel(task, wb.title)} afgerond, ${
            hours ?? 0
          } u via timer`,
        );
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
        await appendActivity(
          tx,
          user,
          project.id,
          `Uren ${taskScopeLabel(task, wb.title)}: ${task.hours ?? 0} naar ${
            input.hours > 0 ? input.hours : 0
          } u`,
        );
      }
      await audit(tx, user, "workOrder.task.hours", "workOrderTask", task.id, {
        hours: next,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// =========================================================================
// TASK PHOTOS — TODO(Phase 7): real uploads; for now append placeholders.
// =========================================================================

async function appendPhoto(
  user: AuthUser,
  workOrderId: string,
  taskId: string,
  field: "beforePhotos" | "resultPhotos",
  prefix: string,
) {
  const task = await loadTask(workOrderId, taskId);
  const placeholder = `${prefix}-${Date.now()}.jpg`; // TODO(Phase 7) real upload
  await prisma.$transaction(async (tx) => {
    await tx.workOrderTask.update({
      where: { id: task.id },
      data: { [field]: { push: placeholder } },
    });
    await audit(tx, user, "workOrder.task.photo.add", "workOrderTask", task.id, {
      field,
      photo: placeholder,
    });
  });
}

// POST /work-orders/:id/tasks/:taskId/photos/before
workOrdersRouter.post(
  "/:id/tasks/:taskId/photos/before",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    await appendPhoto(
      user,
      req.params.id,
      req.params.taskId,
      "beforePhotos",
      "begin",
    );
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/tasks/:taskId/photos/result
workOrdersRouter.post(
  "/:id/tasks/:taskId/photos/result",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    await requireWritableWorkOrder(user, req.params.id);
    await appendPhoto(
      user,
      req.params.id,
      req.params.taskId,
      "resultPhotos",
      "resultaat",
    );
    res.status(201).json(await reloadWorkOrder(user, req.params.id));
  }),
);

// DELETE /work-orders/:id/tasks/:taskId/photos {photo} — remove from either set.
workOrdersRouter.delete(
  "/:id/tasks/:taskId/photos",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = removePhotoSchema.parse(req.body);
    await requireWritableWorkOrder(user, req.params.id);
    const task = await loadTask(req.params.id, req.params.taskId);
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
      await appendActivity(
        tx,
        user,
        project.id,
        seeded
          ? `Taak toegevoegd bij ${scope}: ${input?.name ?? ""}`
          : `Product toegevoegd bij ${scope}`,
      );
      await audit(tx, user, "workOrder.material.add", "taskMaterial", mat.id);
      // unitPrice may have been seeded → keep quote amount in sync.
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
        await appendActivity(
          tx,
          user,
          project.id,
          `Product: "${before.name || "leeg"}" gewijzigd naar "${
            clampText(input.name) || "leeg"
          }"`,
        );
      }
      if (input.quantity !== undefined && input.quantity !== before.quantity) {
        await appendActivity(
          tx,
          user,
          project.id,
          `${before.name || "Product"}: gepland aantal ${before.quantity} naar ${
            input.quantity
          } ${before.unit}`,
        );
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
      await appendActivity(
        tx,
        user,
        project.id,
        `Product verwijderd: ${before.name || "product"}`,
      );
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
        const suffix =
          diff > 0
            ? ` (${diff} ${before.unit} meer dan gepland)`
            : diff < 0
              ? ` (${-diff} ${before.unit} minder dan gepland)`
              : "";
        await appendActivity(
          tx,
          user,
          project.id,
          `Verbruik ${before.name || "product"}: ${
            before.usedQuantity ?? 0
          } naar ${used} ${before.unit}${suffix}`,
        );
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
        `${before.label || before.name || "taak"}: ${
          before.done ? "heropend" : "afgerond"
        }`,
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

// Mark all NAMED materials (across the project's workOrders) done. Returns the
// count newly flipped (mirrors completeAllTasks). Caller wraps in a tx.
async function completeAllTasks(
  tx: Tx,
  projectId: string,
): Promise<number> {
  const named = await tx.taskMaterial.findMany({
    where: {
      task: { workOrder: { projectId } },
      done: false,
      NOT: { name: "" },
    },
    select: { id: true },
  });
  if (named.length > 0) {
    await tx.taskMaterial.updateMany({
      where: { id: { in: named.map((m) => m.id) } },
      data: { done: true },
    });
  }
  return named.length;
}

// POST /work-orders/:id/complete-all — mark all named materials done.
workOrdersRouter.post(
  "/:id/complete-all",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    await prisma.$transaction(async (tx) => {
      const changed = await completeAllTasks(tx, project.id);
      if (changed > 0) {
        await appendActivity(
          tx,
          user,
          project.id,
          `${changed} ${changed === 1 ? "taak" : "taken"} in één keer afgevinkt`,
        );
      }
      await audit(tx, user, "workOrder.complete-all", "project", project.id, {
        changed,
      });
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);

// POST /work-orders/:id/finish {signature} — finishWorkOrder: complete all,
// store signature, set project stage=done (→ status=closing).
workOrdersRouter.post(
  "/:id/finish",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = finishSchema.parse(req.body);
    const { project } = await requireWritableWorkOrder(user, req.params.id);
    await prisma.$transaction(async (tx) => {
      await completeAllTasks(tx, project.id);
      await tx.project.update({
        where: { id: project.id },
        data: {
          signature: clampText(input.signature),
          stage: "done",
          status: statusForStage("done"), // → "closing"
        },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        "Werkbon afgerond en ondertekend",
      );
      await audit(tx, user, "workOrder.finish", "workOrder", req.params.id);
    });
    res.json(await reloadWorkOrder(user, req.params.id));
  }),
);
