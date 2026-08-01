import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { statusForStage, canSeeAllProjects, type UserRole } from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { parsePageParams, paginate } from "../../lib/pagination.js";
import { storeUpload, deleteStored } from "../../lib/attachUpload.js";
import { uploadSingle } from "../../lib/upload.js";
import { buildUrlMap } from "../../lib/photoUrls.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import type { AuthUser } from "../../auth/types.js";
import { recomputeWorkOrdersForProject } from "../work-orders/status.js";
import {
  projectDto,
  projectSummaryDto,
  activityDto,
  projectInclude,
  projectIncludeFor,
  type ProjectWithRelations,
} from "./dto.js";

// Role + org-aware DTO wrappers: resolve the org's hide-prices flag once, then
// serialize. Used everywhere a project DTO is returned so technicians only see
// prices when the org allows it. Also prebuilds the photo key→url lookup so the
// (synchronous) DTO can emit renderable urls.
async function projectDtoFor(user: AuthUser, p: ProjectWithRelations) {
  const photoKeys = [
    ...p.surveyPhotos,
    ...(p.handover?.photos ?? []),
  ];
  const urlOf = await buildUrlMap(photoKeys);
  return projectDto(p, user.role as UserRole, urlOf);
}

async function projectSummaryListFor(
  user: AuthUser,
  rows: (import("@prisma/client").Project & {
    _count?: { workOrders: number };
    workOrders?: { value: number }[];
  })[],
) {
  return rows.map((p) => projectSummaryDto(p, user.role as UserRole));
}
import { projectScopeWhere, canViewProject } from "./visibility.js";
import {
  createProjectSchema,
  updateProjectSchema,
  statusSchema,
  stageSchema_,
  urgencyBodySchema,
  resolveBlockerSchema,
  teamSchema,
  commentSchema,
  updateIntakeSchema,
  completeIntakeSchema,
  addExtraWorkSchema,
  rejectExtraWorkSchema,
  restpuntenSchema,
  signHandoverSchema,
  removePhotoSchema,
} from "./schema.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

// --- local helpers --------------------------------------------------------

type Tx = Prisma.TransactionClient;

const STAGE_ORDER = ["concept", "in_progress", "ready", "done"] as const;
type Stage = (typeof STAGE_ORDER)[number];

const STATUS_LABELS: Record<string, string> = {
  sales: "Verkoop",
  operations: "Operatie",
  closing: "Afronding",
};

// nextStep i18n keys by status (client renders via domain.nextStep.<key>).
const NEXT_STEP_BY_STATUS: Record<string, string> = {
  sales: "sendQuote",
  operations: "executeWork",
  closing: "handoverInvoice",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEuro(value: number): string {
  return `€ ${Math.round(value).toLocaleString("nl-NL")}`;
}

// Append a ProjectActivity row inside a transaction (replaces makeActivity +
// logChange from the store).
// System/status/scheduled events store a language-neutral messageKey + params
// (rendered client-side via i18n). `comment` events store the user's own text in
// `body` (free text, not translatable). Internals are English; no display prose.
async function appendActivity(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  type: "status_change" | "comment" | "scheduled" | "system",
  messageKey: string,
  opts?: {
    params?: Record<string, unknown>;
    statuses?: { fromStatus: "sales" | "operations" | "closing"; toStatus: "sales" | "operations" | "closing" };
  },
): Promise<void> {
  await tx.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      type,
      messageKey,
      params: (opts?.params ?? undefined) as Prisma.InputJsonValue | undefined,
      fromStatus: opts?.statuses?.fromStatus,
      toStatus: opts?.statuses?.toStatus,
    },
  });
}

// Comment events carry the user's free text in `body` (no messageKey).
async function appendComment(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  text: string,
): Promise<void> {
  await tx.projectActivity.create({
    data: { projectId, userId: user.id, type: "comment", body: text },
  });
}

// Load a project (scoped to org + visibility), throw 404 if not visible.
// Returns just the header row plus installers for write-gating.
async function loadProjectForUser(user: AuthUser, id: string) {
  const project = await prisma.project.findFirst({
    where: projectScopeWhere(user, { id }),
    include: { installers: { select: { id: true } } },
  });
  if (!project) throw NotFound("Project not found");
  return project;
}

// =========================================================================
// LIST + DETAIL
// =========================================================================

// GET / — visibility-filtered, orgId-scoped, cursor-paginated. Returns
// { items, nextCursor }. Optional ?search filters across the header fields.
projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const params = parsePageParams(req);

    // Combine search with the visibility scope via projectScopeWhere's AND-merge
    // `extra` arg — never spread its result, which would clobber the OR that
    // enforces technician visibility.
    const ci = { contains: params.search, mode: "insensitive" as const };
    const where = params.search
      ? projectScopeWhere(user, {
          OR: [
            { projectNumber: ci },
            { name: ci },
            { customerName: ci },
            { city: ci },
            { address: ci },
          ],
        })
      : projectScopeWhere(user);

    const page = await paginate(params, (args) =>
      prisma.project.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          _count: { select: { workOrders: true } },
          // Werkbon values → the project's value is their sum (per-werkbon billing).
          workOrders: { select: { value: true } },
        },
        ...args,
      }),
    );

    const items = await projectSummaryListFor(user, page.items);
    res.json({ items, nextCursor: page.nextCursor });
  }),
);

// GET /:id — full nested aggregate DTO (visibility-checked).
projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const project = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      // ...For(user): the nested werkbon list is scoped per assignment, so a
      // technician on this project's crew still only sees THEIR visits here.
      include: projectIncludeFor(user),
    });
    if (!project) throw NotFound("Project not found");
    res.json(await projectDtoFor(user, project));
  }),
);

// =========================================================================
// CREATE / UPDATE / DELETE / ARCHIVE
// =========================================================================

// POST / — admin only. Mirror store createProject.
projectsRouter.post(
  "/",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createProjectSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, orgId: user.orgId, deletedAt: null },
    });
    if (!customer) throw BadRequest("Customer not found in organization");

    // Resolve the managed work type (preferred over free-text insulationType).
    // workTypeId must belong to the org; its name mirrors into insulationType.
    let workTypeId: string | null = null;
    let workTypeName: string | null = null;
    if (input.workTypeId) {
      const wt = await prisma.workType.findFirst({
        where: { id: input.workTypeId, orgId: user.orgId },
      });
      if (!wt) throw BadRequest("Work type not found in organization");
      workTypeId = wt.id;
      workTypeName = wt.name;
    }

    // Resolve an optional customer location (the job site); falls back to the
    // customer's own address fields below.
    let location: { id: string; address: string; postalCode: string; city: string } | null =
      null;
    if (input.locationId) {
      const loc = await prisma.location.findFirst({
        where: { id: input.locationId, customerId: customer.id },
      });
      if (!loc) throw BadRequest("Location not found for customer");
      location = loc;
    }

    // Generate next sequential project number OP-YYYY-NNN for the org/year.
    const year = new Date().getFullYear();
    const existing = await prisma.project.findMany({
      where: { orgId: user.orgId },
      select: { projectNumber: true },
    });
    const maxNum = existing.reduce((max, { projectNumber }) => {
      const m = projectNumber.match(/OP-(\d{4})-(\d+)/);
      if (!m) return max;
      const [, py, num] = m;
      return py === String(year) ? Math.max(max, Number(num)) : max;
    }, 0);
    const projectNumber = `OP-${year}-${String(maxNum + 1).padStart(3, "0")}`;

    // Display work type: the managed name wins; else free-text; else placeholder.
    const insulation =
      workTypeName ?? input.insulationType?.trim() ?? "";
    const notes = input.notes ? clampText(input.notes) : "";

    // Site address: chosen location, else the customer's own address.
    const siteAddress = location?.address ?? customer.address;
    const sitePostalCode = location?.postalCode ?? customer.postalCode;
    const siteCity = location?.city ?? customer.city;

    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          orgId: user.orgId,
          projectNumber,
          name: input.name?.trim() ? clampText(input.name).trim() : null,
          customerId: customer.id,
          customerName: customer.name,
          locationId: location?.id ?? null,
          address: siteAddress,
          postalCode: sitePostalCode,
          city: siteCity,
          workTypeId,
          insulationType: insulation,
          description: notes,
          workTypes: [],
          exclusions: "",
          stage: "concept",
          status: "sales",
          urgency: "normal",
          nextStepKey: "planIntake",
          materialsReady: false,
          value: 0,
          // Default nested rows (mirror buildEmptyProject).
          intake: {
            create: {
              status: "planned",
              contactName: customer.contactName,
              contactEmail: customer.email,
              contactPhone: customer.phone,
              address: `${siteAddress}, ${sitePostalCode} ${siteCity}`,
              insulationType: insulation,
              squareMeters: 0,
              notes,
              risks: "",
              estimatedMaterials: [],
              estimatedLaborHours: 0,
              photos: [],
            },
          },
          // NOTE: quote + invoice are per-WERKBON now (billing is per werkbon),
          // so they're created with the work order, not here on the project.
          deliveryChecklist: {
            create: {
              items: {
                create: [
                  { labelKey: "workDone", ordinal: 0 },
                  { labelKey: "photosUploaded", ordinal: 1 },
                  { labelKey: "materialsRegistered", ordinal: 2 },
                  { labelKey: "extraWorkApproved", ordinal: 3 },
                  { labelKey: "clientSignature", ordinal: 4 },
                  { labelKey: "qualityChecked", ordinal: 5 },
                ],
              },
            },
          },
        },
        include: projectInclude,
      });
      await appendActivity(tx, user, project.id, "system", "project.created");
      await audit(tx, user, "project.create", "project", project.id, {
        projectNumber,
        customerId: customer.id,
      });
      return project;
    });

    res.status(201).json(await projectDtoFor(user, created));
  }),
);

// PATCH /:id — header fields. admin only. Mirror updateProject date logic.
projectsRouter.patch(
  "/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateProjectSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);

    // Scheduling (plannedDate/plannedEndDate) is per-werkbon now — handled by
    // PATCH /work-orders/:id, not here.
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined)
      data.name = clampText(input.name).trim() || null;
    if (input.description !== undefined)
      data.description = clampText(input.description);
    if (input.address !== undefined) data.address = clampText(input.address);
    if (input.postalCode !== undefined)
      data.postalCode = clampText(input.postalCode);
    if (input.city !== undefined) data.city = clampText(input.city);
    if (input.contactName !== undefined)
      data.contactName = clampText(input.contactName).trim() || null;
    if (input.contactPhone !== undefined)
      data.contactPhone = clampText(input.contactPhone).trim() || null;
    if (input.instructions !== undefined)
      data.instructions = clampText(input.instructions).trim() || null;
    if (input.insulationType !== undefined)
      data.insulationType = clampText(input.insulationType);
    if (input.materialsReady !== undefined)
      data.materialsReady = input.materialsReady;
    if (input.exclusions !== undefined)
      data.exclusions = clampText(input.exclusions);
    if (input.billingType !== undefined) data.billingType = input.billingType;
    if (input.urgency !== undefined) data.urgency = input.urgency;

    // Switch the project to a different CUSTOMER. This moves the job — and all
    // its werkbonnen, invoices and meerwerk approvals — out of the old
    // customer's portal and into the new one's (the client role is scoped by
    // project.customerId). Three things travel with it:
    //   - customerName, the denormalized copy read by search/lists/PDFs;
    //   - locationId, because a Location belongs to a customer and would
    //     otherwise dangle on a project the customer no longer owns;
    //   - NOT address/postalCode/city: the job SITE doesn't move just because
    //     the billing customer was corrected.
    let newCustomer: { id: string; name: string } | null = null;
    if (input.customerId !== undefined && input.customerId !== existing.customerId) {
      const found = await prisma.customer.findFirst({
        where: { id: input.customerId, orgId: user.orgId, deletedAt: null },
        select: { id: true, name: true },
      });
      // 404, not 400: a cross-org id must not reveal that the customer exists.
      if (!found) throw NotFound("Customer not found");
      newCustomer = found;
      data.customer = { connect: { id: found.id } };
      data.customerName = found.name;

      // Keep the saved location only when the NEW customer owns it.
      if (existing.locationId) {
        const keeps = await prisma.location.findFirst({
          where: { id: existing.locationId, customerId: found.id },
          select: { id: true },
        });
        if (!keeps) data.location = { disconnect: true };
      }
    }

    // Team + work type (all project-level). Validate org membership first.
    if (input.projectLeaderId) {
      const leader = await prisma.employee.findFirst({
        where: { id: input.projectLeaderId, orgId: user.orgId, deletedAt: null },
      });
      if (!leader) throw BadRequest("Project leader not found in organization");
    }
    if (input.projectLeaderId !== undefined) {
      data.projectLeader = input.projectLeaderId
        ? { connect: { id: input.projectLeaderId } }
        : { disconnect: true };
    }
    if (input.installerIds !== undefined && input.installerIds.length > 0) {
      const found = await prisma.employee.count({
        where: { id: { in: input.installerIds }, orgId: user.orgId, deletedAt: null },
      });
      if (found !== new Set(input.installerIds).size) {
        throw BadRequest("One or more installers not found in organization");
      }
    }
    if (input.installerIds !== undefined) {
      data.installers = { set: input.installerIds.map((id) => ({ id })) };
    }
    if (input.workTypeId) {
      const wt = await prisma.workType.findFirst({
        where: { id: input.workTypeId, orgId: user.orgId },
      });
      if (!wt) throw BadRequest("Work type not found in organization");
      // Keep the free-text mirror in sync (workTypeName wins in DTOs).
      data.insulationType = wt.name;
    }
    if (input.workTypeId !== undefined) {
      data.workType = input.workTypeId
        ? { connect: { id: input.workTypeId } }
        : { disconnect: true };
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: existing.id }, data });
      await audit(tx, user, "project.update", "project", existing.id, input);
      // A customer switch changes WHO CAN SEE this job, so it gets its own
      // audit entry (with both ids) and shows up in the project feed — an
      // access change must never be silent.
      if (newCustomer) {
        await audit(tx, user, "project.customerChanged", "project", existing.id, {
          from: existing.customerId,
          fromName: existing.customerName,
          to: newCustomer.id,
          toName: newCustomer.name,
        });
        await appendActivity(tx, user, existing.id, "system", "project.customerChanged", {
          params: { from: existing.customerName, to: newCustomer.name },
        });
      }
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// DELETE /:id — admin only, hard delete (FK cascade removes children).
projectsRouter.delete(
  "/:id",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadProjectForUser(user, req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.project.delete({ where: { id: existing.id } });
      await audit(tx, user, "project.delete", "project", existing.id);
    });
    res.status(204).end();
  }),
);

// POST /:id/archive — admin. archived true, stage done, status closing.
projectsRouter.post(
  "/:id/archive",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadProjectForUser(user, req.params.id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: { archived: true, stage: "done", status: "closing" },
      });
      await appendActivity(tx, user, existing.id, "system", "project.archived");
      await audit(tx, user, "project.archive", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });
    res.json(await projectDtoFor(user, updated));
  }),
);

// =========================================================================
// STATUS + STAGE
// =========================================================================

// POST /:id/status — admin. {status}. status_change activity.
projectsRouter.post(
  "/:id/status",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { status } = statusSchema.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
    });
    if (!existing) throw NotFound("Project not found");
    if (existing.status === status) {
      throw BadRequest(`Project staat al op ${STATUS_LABELS[status]}`);
    }
    const fromStatus = existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.ProjectUpdateInput = {
        status,
        nextStepKey: NEXT_STEP_BY_STATUS[status],
      };
      // Quote-accept + invoice-ready are per-WERKBON now (billing is per werkbon),
      // handled by each werkbon's own lifecycle — not on the project status.
      await tx.project.update({ where: { id: existing.id }, data });
      await appendActivity(tx, user, existing.id, "status_change", "project.statusChanged", {
        params: { from: fromStatus, to: status },
        statuses: { fromStatus, toStatus: status },
      });
      await audit(tx, user, "project.status", "project", existing.id, {
        fromStatus,
        toStatus: status,
      });
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// POST /:id/stage — admin. {stage} or {advance:true}. setStage semantics.
projectsRouter.post(
  "/:id/stage",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = stageSchema_.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
    });
    if (!existing) throw NotFound("Project not found");

    let stage: Stage;
    if (body.advance) {
      const idx = STAGE_ORDER.indexOf(existing.stage as Stage);
      stage = STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
    } else {
      stage = body.stage as Stage;
    }
    const status = statusForStage(stage);

    const updated = await prisma.$transaction(async (tx) => {
      // Invoice draft + totals are seeded per-WERKBON now (billing per werkbon),
      // driven by each werkbon's lifecycle — not by the project's stage.
      await tx.project.update({
        where: { id: existing.id },
        data: { stage, status },
      });
      await appendActivity(tx, user, existing.id, "system", "project.stageChanged", {
        params: { stage },
      });
      await audit(tx, user, "project.stage", "project", existing.id, { stage });
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// POST /:id/materials/check — admin. Mirror moveToMaterialsCheck.
projectsRouter.post(
  "/:id/materials/check",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: { materialRequirements: true },
    });
    if (!existing) throw NotFound("Project not found");

    // Material readiness (mirror getProjectMaterialReadiness).
    const reqs = existing.materialRequirements;
    const readiness =
      reqs.length === 0
        ? "needs_ordering"
        : reqs.every((r) => r.quantityInStock >= r.quantityNeeded)
          ? "available"
          : reqs.some(
                (r) =>
                  r.quantityInStock > 0 &&
                  r.quantityInStock < r.quantityNeeded,
              )
            ? "partly_available"
            : "needs_ordering";

    const available = readiness === "available";
    const fromStatus = existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          // Keep a user-entered blocker; otherwise use the system-default key.
          blocker: available ? null : existing.blocker,
          blockerKey:
            available || existing.blocker ? null : "materialsUnavailable",
          nextStepKey: available ? "planProject" : "createPurchaseList",
          status: "operations",
          urgency: available ? existing.urgency : "blocked",
        },
      });
      // Urgency may have flipped to "blocked" → resync work-order statuses.
      await recomputeWorkOrdersForProject(tx, existing.id);
      if (fromStatus !== "operations") {
        await appendActivity(tx, user, existing.id, "status_change", "project.materialCheckStarted", {
          statuses: { fromStatus, toStatus: "operations" },
        });
      }
      await audit(tx, user, "project.materialsCheck", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// =========================================================================
// INTAKE
// =========================================================================

// PATCH /:id/intake — admin. Update intake fields.
projectsRouter.patch(
  "/:id/intake",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateIntakeSchema.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: { intake: true },
    });
    if (!existing) throw NotFound("Project not found");
    if (!existing.intake) throw NotFound("Intake not found");

    const data: Prisma.IntakeUpdateInput = {};
    if (input.plannedDate !== undefined)
      data.plannedDate = input.plannedDate || null;
    if (input.contactName !== undefined)
      data.contactName = clampText(input.contactName);
    if (input.contactEmail !== undefined)
      data.contactEmail = clampText(input.contactEmail);
    if (input.contactPhone !== undefined)
      data.contactPhone = clampText(input.contactPhone);
    if (input.address !== undefined) data.address = clampText(input.address);
    if (input.insulationType !== undefined)
      data.insulationType = clampText(input.insulationType);
    if (input.squareMeters !== undefined)
      data.squareMeters = clampNumber(input.squareMeters);
    if (input.cavityWidthMm !== undefined)
      data.cavityWidthMm =
        input.cavityWidthMm === null ? null : clampNumber(input.cavityWidthMm);
    if (input.existingInsulation !== undefined)
      data.existingInsulation = input.existingInsulation;
    if (input.buildingType !== undefined)
      data.buildingType =
        input.buildingType === null ? null : clampText(input.buildingType);
    if (input.accessibility !== undefined)
      data.accessibility =
        input.accessibility === null ? null : clampText(input.accessibility);
    if (input.notes !== undefined) data.notes = clampText(input.notes);
    if (input.risks !== undefined) data.risks = clampText(input.risks);
    if (input.estimatedLaborHours !== undefined)
      data.estimatedLaborHours = clampNumber(input.estimatedLaborHours);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.intake.update({ where: { id: existing.intake!.id }, data });
      await audit(tx, user, "project.intake.update", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// POST /:id/intake/complete — admin. Mirror completeIntake.
projectsRouter.post(
  "/:id/intake/complete",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const data = completeIntakeSchema.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: { intake: true },
    });
    if (!existing) throw NotFound("Project not found");
    if (!existing.intake) throw NotFound("Intake not found");

    const insulationType = clampText(data.insulationType ?? existing.insulationType);
    const squareMeters = clampNumber(data.squareMeters ?? existing.squareMeters);
    const blocker = data.blocker ? clampText(data.blocker) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      // Update intake: copy fields, set status completed.
      const intakeData: Prisma.IntakeUpdateInput = {
        insulationType,
        squareMeters,
        status: "completed",
        photos: existing.intake!.photos.length
          ? existing.intake!.photos
          : ["intake-bedrijfslocatie.jpg"],
      };
      if (data.cavityWidthMm !== undefined)
        intakeData.cavityWidthMm = clampNumber(data.cavityWidthMm);
      if (data.existingInsulation !== undefined)
        intakeData.existingInsulation = data.existingInsulation;
      if (data.buildingType !== undefined)
        intakeData.buildingType = clampText(data.buildingType);
      if (data.accessibility !== undefined)
        intakeData.accessibility = clampText(data.accessibility);
      if (data.estimatedLaborHours !== undefined)
        intakeData.estimatedLaborHours = clampNumber(data.estimatedLaborHours);
      if (data.notes !== undefined) intakeData.notes = clampText(data.notes);
      if (data.risks !== undefined) intakeData.risks = clampText(data.risks);
      await tx.intake.update({
        where: { id: existing.intake!.id },
        data: intakeData,
      });

      // Draft quote seeding is per-WERKBON now (billing per werkbon) — the
      // project no longer carries a single quote, so intake completion only
      // finalizes the intake + project header fields.
      await tx.project.update({
        where: { id: existing.id },
        data: {
          insulationType,
          squareMeters,
          blocker: blocker ?? existing.blocker,
          urgency: blocker ? "blocked" : existing.urgency,
          nextStepKey: blocker ? "resolveBlocker" : "sendQuote",
        },
      });
      // Urgency may have flipped to/from "blocked" → resync work-order statuses.
      await recomputeWorkOrdersForProject(tx, existing.id);

      if (blocker) {
        await appendActivity(tx, user, existing.id, "system", "project.intakeCompletedWithBlocker", {
          params: { blocker },
        });
      } else {
        await appendActivity(tx, user, existing.id, "system", "project.intakeCompleted");
      }
      await audit(tx, user, "project.intake.complete", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

async function reloadProject(user: AuthUser, projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: projectInclude,
  });
  return projectDtoFor(user, p);
}

// =========================================================================
// URGENCY / BLOCKER / TEAM
// =========================================================================

// POST /:id/urgency — admin. {urgency} + activity.
projectsRouter.post(
  "/:id/urgency",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { urgency } = urgencyBodySchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: { urgency },
      });
      // Urgency feeds each work order's denormalized listStatus → resync them.
      await recomputeWorkOrdersForProject(tx, existing.id);
      await appendActivity(tx, user, existing.id, "system", "project.urgencyChanged", {
        params: { urgency },
      });
      await audit(tx, user, "project.urgency", "project", existing.id, { urgency });
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// POST /:id/resolve-blocker — admin. {note?} + activity.
projectsRouter.post(
  "/:id/resolve-blocker",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { note } = resolveBlockerSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);
    if (!existing.blocker) throw BadRequest("Project has no blocker");
    const trimmed = note ? clampText(note).trim() : "";

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          blocker: null,
          blockerKey: null,
          urgency: existing.urgency === "blocked" ? "normal" : existing.urgency,
          nextStepKey: "sendQuote",
        },
      });
      // Urgency may have flipped from "blocked" → resync work-order statuses.
      await recomputeWorkOrdersForProject(tx, existing.id);
      await appendActivity(
        tx,
        user,
        existing.id,
        "system",
        trimmed ? "project.blockerResolvedWithNote" : "project.blockerResolved",
        { params: { blocker: existing.blocker ?? "—", note: trimmed } },
      );
      await audit(tx, user, "project.resolveBlocker", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// POST /:id/team — admin. Set project leader / team leader / installers.
projectsRouter.post(
  "/:id/team",
  requireRole("admin", "office"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = teamSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);

    const data: Prisma.ProjectUpdateInput = {};
    if (input.projectLeaderId !== undefined)
      data.projectLeader = input.projectLeaderId
        ? { connect: { id: input.projectLeaderId } }
        : { disconnect: true };
    if (input.teamLeaderId !== undefined)
      data.teamLeader = input.teamLeaderId
        ? { connect: { id: input.teamLeaderId } }
        : { disconnect: true };
    if (input.installerIds !== undefined)
      data.installers = { set: input.installerIds.map((id) => ({ id })) };

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: existing.id }, data });
      await appendActivity(tx, user, existing.id, "system", "project.teamAssigned");
      await audit(tx, user, "project.team", "project", existing.id, input);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(await projectDtoFor(user, updated));
  }),
);

// =========================================================================
// ACTIVITY + COMMENTS
// =========================================================================

// GET /:id/activity — visibility-checked, newest first.
projectsRouter.get(
  "/:id/activity",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    // Visibility check via scoped lookup.
    await loadProjectForUser(user, req.params.id);
    const rows = await prisma.projectActivity.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    res.json(rows.map(activityDto));
  }),
);

// POST /:id/comments — admin + technician (assigned) + client (own).
projectsRouter.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { body } = commentSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);
    // loadProjectForUser already enforces visibility; canViewProject is the
    // same gate for clarity (admin: any, client: own, technician: assigned).
    if (!canViewProject(user, existing)) {
      throw Forbidden("Not allowed to comment on this project");
    }
    const trimmed = clampText(body).trim();
    if (!trimmed) throw BadRequest("Empty comment");

    await prisma.$transaction(async (tx) => {
      await appendComment(tx, user, existing.id, trimmed);
      await audit(tx, user, "project.comment", "project", existing.id);
    });

    const rows = await prisma.projectActivity.findMany({
      where: { projectId: existing.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    res.status(201).json(rows.map(activityDto));
  }),
);

// POST /:id/survey/photo — upload a survey (opname) photo onto the project.
projectsRouter.post(
  "/:id/survey/photo",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const project = await loadProjectForUser(user, req.params.id);
    const key = await storeUpload(user, req.file, "survey", project.id);
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: { surveyPhotos: { push: key } },
      });
      await audit(tx, user, "project.survey.photo", "project", project.id, {
        photo: key,
      });
    });
    res.status(201).json(await reloadProject(user, project.id));
  }),
);

// DELETE /:id/survey/photo {photo} — remove a survey photo by object key.
projectsRouter.delete(
  "/:id/survey/photo",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = removePhotoSchema.parse(req.body);
    const project = await loadProjectForUser(user, req.params.id);
    const full = await prisma.project.findUnique({
      where: { id: project.id },
      select: { surveyPhotos: true },
    });
    const existed = full?.surveyPhotos.includes(input.photo) ?? false;
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: {
          surveyPhotos: (full?.surveyPhotos ?? []).filter((p) => p !== input.photo),
        },
      });
      await audit(tx, user, "project.survey.photo.remove", "project", project.id, {
        photo: input.photo,
      });
    });
    if (existed) await deleteStored(input.photo);
    res.json(await reloadProject(user, project.id));
  }),
);

// =========================================================================
// HANDOVER — admin + technician (assigned)
// =========================================================================

// Gate handover writes to whoever sees the project org-wide (office + foreman —
// registration work, so the foreman may do it on any project) or a technician
// on an assigned one.
function assertHandoverWriter(
  user: AuthUser,
  project: {
    customerId: string;
    teamLeaderId: string | null;
    projectLeaderId: string | null;
    installers?: { id: string }[];
  },
) {
  if (canSeeAllProjects(user.role)) return;
  if (user.role === "technician" && canViewProject(user, project)) return;
  throw Forbidden("Not allowed for this handover");
}

// POST /:id/handover/init — create checklist if absent. Mirror initHandover.
projectsRouter.post(
  "/:id/handover/init",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: {
        handover: { include: { checklist: true } },
        installers: { select: { id: true } },
      },
    });
    if (!existing) throw NotFound("Project not found");
    assertHandoverWriter(user, existing);

    if (existing.handover && existing.handover.checklist.length > 0) {
      return res.json(await reloadProject(user, existing.id));
    }

    const items = [
      { labelKey: "workDone", ordinal: 0 },
      { labelKey: "beforeAfterPhotos", ordinal: 1 },
      { labelKey: "fireSealsRegistered", ordinal: 2 },
      { labelKey: "extraWorkAligned", ordinal: 3 },
      { labelKey: "workplaceCleaned", ordinal: 4 },
      { labelKey: "qualityApproved", ordinal: 5 },
    ];

    await prisma.$transaction(async (tx) => {
      if (existing.handover) {
        await tx.handoverItem.createMany({
          data: items.map((i) => ({ ...i, handoverId: existing.handover!.id })),
        });
      } else {
        await tx.handover.create({
          data: {
            projectId: existing.id,
            checklist: { create: items },
          },
        });
      }
      await audit(tx, user, "project.handover.init", "project", existing.id);
    });

    res.json(await reloadProject(user, existing.id));
  }),
);

// Load handover scoped to a visible project, with writer gate.
async function loadHandover(user: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: projectScopeWhere(user, { id: projectId }),
    include: { handover: true, installers: { select: { id: true } } },
  });
  if (!project) throw NotFound("Project not found");
  assertHandoverWriter(user, project);
  if (!project.handover) throw NotFound("Handover not found");
  return { project, handover: project.handover };
}

// POST /:id/handover/items/:itemId/toggle.
projectsRouter.post(
  "/:id/handover/items/:itemId/toggle",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, handover } = await loadHandover(user, req.params.id);
    const item = await prisma.handoverItem.findFirst({
      where: { id: req.params.itemId, handoverId: handover.id },
    });
    if (!item) throw NotFound("Handover item not found");

    await prisma.$transaction(async (tx) => {
      await tx.handoverItem.update({
        where: { id: item.id },
        data: { done: !item.done },
      });
      await audit(tx, user, "project.handover.toggle", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/handover/photo — upload a handover photo (multipart "file").
projectsRouter.post(
  "/:id/handover/photo",
  uploadSingle,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, handover } = await loadHandover(user, req.params.id);
    const key = await storeUpload(user, req.file, "handover", handover.id);

    await prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id: handover.id },
        data: { photos: { push: key } },
      });
      await audit(tx, user, "project.handover.photo", "project", project.id, {
        photo: key,
      });
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// DELETE /:id/handover/photo {photo} — remove a handover photo by object key.
projectsRouter.delete(
  "/:id/handover/photo",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = removePhotoSchema.parse(req.body);
    const { project, handover } = await loadHandover(user, req.params.id);
    const existed = handover.photos.includes(input.photo);
    await prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id: handover.id },
        data: { photos: handover.photos.filter((p) => p !== input.photo) },
      });
      await audit(tx, user, "project.handover.photo.remove", "project", project.id, {
        photo: input.photo,
      });
    });
    if (existed) await deleteStored(input.photo);
    res.json(await reloadProject(user, project.id));
  }),
);

// PATCH /:id/handover/restpunten — {restpunten}.
projectsRouter.patch(
  "/:id/handover/restpunten",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { restpunten } = restpuntenSchema.parse(req.body);
    const { project, handover } = await loadHandover(user, req.params.id);

    await prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id: handover.id },
        data: { restpunten: clampText(restpunten) },
      });
      await audit(tx, user, "project.handover.restpunten", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/handover/sign — {signedBy}. Mirror signHandover.
projectsRouter.post(
  "/:id/handover/sign",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { signedBy } = signHandoverSchema.parse(req.body);
    const { project, handover } = await loadHandover(user, req.params.id);
    const name = clampText(signedBy).trim();
    if (!name) throw BadRequest("signedBy required");

    await prisma.$transaction(async (tx) => {
      await tx.handover.update({
        where: { id: handover.id },
        data: { signedBy: name, completedAt: todayIso() },
      });
      await appendActivity(tx, user, project.id, "system", "handover.signed", {
        params: { name },
      });
      await audit(tx, user, "project.handover.sign", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);
