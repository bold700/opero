import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  statusForStage,
  deriveQuoteLineItems,
  type UserRole,
} from "@opero/shared";
import { prisma } from "../../db/client.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { BadRequest, Forbidden, NotFound } from "../../lib/httpError.js";
import { clampText, clampNumber } from "../../lib/clamp.js";
import { audit } from "../../lib/audit.js";
import { requireAuth, requireRole } from "../../auth/middleware.js";
import type { AuthUser } from "../../auth/types.js";
import {
  projectDto,
  projectSummaryDto,
  activityDto,
  projectInclude,
} from "./dto.js";
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
  addQuoteLineSchema,
  updateQuoteLineSchema,
  quoteFromCatalogSchema,
  addMeerwerkSchema,
  rejectMeerwerkSchema,
  restpuntenSchema,
  signOpleveringSchema,
} from "./schema.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

// --- local helpers --------------------------------------------------------

type Tx = Prisma.TransactionClient;

const STAGE_ORDER = ["concept", "in_progress", "ready", "done"] as const;
type Stage = (typeof STAGE_ORDER)[number];

const STATUS_LABELS: Record<string, string> = {
  verkoop: "Verkoop",
  operatie: "Operatie",
  afronding: "Afronding",
};

const NEXT_STEP_BY_STATUS: Record<string, string> = {
  verkoop: "Offerte versturen",
  operatie: "Werk uitvoeren",
  afronding: "Oplevering en factuur",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatEuro(value: number): string {
  return `€ ${Math.round(value).toLocaleString("nl-NL")}`;
}

// Mirror the store's normPriceFor.
function normPriceFor(unit: string): number {
  if (unit === "m") return 22;
  if (unit === "m2") return 38;
  if (unit === "stuks" || unit === "stuk") return 45;
  return 30;
}

// Append a ProjectActivity row inside a transaction (replaces makeActivity +
// logChange from the store).
async function appendActivity(
  tx: Tx,
  user: AuthUser,
  projectId: string,
  type: "status_change" | "comment" | "scheduled" | "system",
  body: string,
  statuses?: { fromStatus: "verkoop" | "operatie" | "afronding"; toStatus: "verkoop" | "operatie" | "afronding" },
): Promise<void> {
  await tx.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      type,
      body,
      fromStatus: statuses?.fromStatus,
      toStatus: statuses?.toStatus,
    },
  });
}

// Recompute quote.amount = sum(round(quantity * unitPrice)) from current lines.
async function recalcQuoteAmount(tx: Tx, quoteId: string): Promise<number> {
  const lines = await tx.quoteLineItem.findMany({ where: { quoteId } });
  const amount = lines.reduce(
    (sum, l) => sum + Math.round(l.quantity * l.unitPrice),
    0,
  );
  await tx.quote.update({ where: { id: quoteId }, data: { amount } });
  return amount;
}

// Derive invoice totals from a project's quote (mirror deriveInvoiceTotals).
function deriveInvoiceTotals(
  quoteAmount: number,
  lineItems: { quantity: number; unitPrice: number; unit: string }[],
): {
  acceptedQuoteAmount: number;
  laborAmount: number;
  materialsAmount: number;
  extraWorkAmount: number;
} {
  const laborLine = lineItems.find((l) => l.unit === "uur");
  const materialLines = lineItems.filter((l) => l.unit !== "uur");
  const laborAmount = laborLine
    ? Math.round(laborLine.quantity * laborLine.unitPrice)
    : 0;
  const materialsAmount = materialLines.reduce(
    (sum, l) => sum + Math.round(l.quantity * l.unitPrice),
    0,
  );
  return {
    acceptedQuoteAmount: quoteAmount,
    extraWorkAmount: 0,
    laborAmount,
    materialsAmount,
  };
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

// GET / — visibility-filtered, orgId-scoped. Returns summary DTOs.
projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const rows = await prisma.project.findMany({
      where: projectScopeWhere(user),
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map((p) => projectSummaryDto(p, user.role as UserRole)));
  }),
);

// GET /:id — full nested aggregate DTO (visibility-checked).
projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const project = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: projectInclude,
    });
    if (!project) throw NotFound("Project not found");
    res.json(projectDto(project, user.role as UserRole));
  }),
);

// =========================================================================
// CREATE / UPDATE / DELETE / ARCHIVE
// =========================================================================

// POST / — admin only. Mirror store createProject.
projectsRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = createProjectSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, orgId: user.orgId, deletedAt: null },
    });
    if (!customer) throw BadRequest("Customer not found in organization");

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

    const defaultInsulation = input.insulationType?.trim() || "Nog te bepalen";
    const notes = input.notes ? clampText(input.notes) : "";

    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          orgId: user.orgId,
          projectNumber,
          name: input.name?.trim() ? clampText(input.name).trim() : null,
          customerId: customer.id,
          customerName: customer.name,
          address: customer.address,
          postalCode: customer.postalCode,
          city: customer.city,
          insulationType: defaultInsulation,
          description: notes,
          werksoorten: [],
          exclusions: "",
          stage: "concept",
          status: "verkoop",
          urgency: "normal",
          nextStep: "Intake inplannen",
          materialsReady: false,
          value: 0,
          // Default nested rows (mirror buildEmptyProject).
          intake: {
            create: {
              status: "planned",
              contactName: customer.contactName,
              contactEmail: customer.email,
              contactPhone: customer.phone,
              address: `${customer.address}, ${customer.postalCode} ${customer.city}`,
              insulationType: defaultInsulation,
              squareMeters: 0,
              notes,
              risks: "",
              estimatedMaterials: [],
              estimatedLaborHours: 0,
              photos: [],
            },
          },
          quote: { create: { status: "draft", amount: 0 } },
          invoice: { create: { status: "not_started" } },
          deliveryChecklist: {
            create: {
              items: {
                create: [
                  { label: "Werk uitgevoerd volgens opdracht", ordinal: 0 },
                  { label: "Fotos geupload", ordinal: 1 },
                  { label: "Materialen geregistreerd", ordinal: 2 },
                  { label: "Meerwerk akkoord", ordinal: 3 },
                  { label: "Handtekening opdrachtgever", ordinal: 4 },
                  { label: "Kwaliteitscheck afgerond", ordinal: 5 },
                ],
              },
            },
          },
        },
        include: projectInclude,
      });
      await appendActivity(tx, user, project.id, "system", "Project aangemaakt");
      await audit(tx, user, "project.create", "project", project.id, {
        projectNumber,
        customerId: customer.id,
      });
      return project;
    });

    res.status(201).json(projectDto(created, user.role as UserRole));
  }),
);

// PATCH /:id — header fields. admin only. Mirror updateProject date logic.
projectsRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateProjectSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);

    // Date reconciliation: plannedEndDate can't precede plannedDate.
    let plannedDate = existing.plannedDate;
    let plannedEndDate = existing.plannedEndDate;
    if (input.plannedDate !== undefined) {
      const nextStart = input.plannedDate || null;
      plannedDate = nextStart;
      if (!nextStart) {
        plannedEndDate = null;
      } else if (plannedEndDate && plannedEndDate < nextStart) {
        plannedEndDate = null;
      }
    }
    if (input.plannedEndDate !== undefined) {
      const end = input.plannedEndDate || null;
      plannedEndDate =
        end && plannedDate && end < plannedDate ? plannedDate : end;
    }

    const data: Prisma.ProjectUpdateInput = {
      plannedDate,
      plannedEndDate,
    };
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

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: existing.id }, data });
      await audit(tx, user, "project.update", "project", existing.id, input);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// DELETE /:id — admin only, hard delete (FK cascade removes children).
projectsRouter.delete(
  "/:id",
  requireRole("admin"),
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

// POST /:id/archive — admin. archived true, stage done, status afronding.
projectsRouter.post(
  "/:id/archive",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await loadProjectForUser(user, req.params.id);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: { archived: true, stage: "done", status: "afronding" },
      });
      await audit(tx, user, "project.archive", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });
    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// =========================================================================
// STATUS + STAGE
// =========================================================================

// POST /:id/status — admin. {status}. status_change activity.
projectsRouter.post(
  "/:id/status",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { status } = statusSchema.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: { quote: { include: { lineItems: true } }, invoice: true },
    });
    if (!existing) throw NotFound("Project not found");
    if (existing.status === status) {
      throw BadRequest(`Project staat al op ${STATUS_LABELS[status]}`);
    }
    const fromStatus = existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.ProjectUpdateInput = {
        status,
        nextStep: NEXT_STEP_BY_STATUS[status],
      };
      // Moving to operatie/afronding implies accepted quote.
      if (
        (status === "operatie" || status === "afronding") &&
        existing.quote
      ) {
        await tx.quote.update({
          where: { id: existing.quote.id },
          data: {
            status: "accepted",
            acceptedDate: existing.quote.acceptedDate ?? todayIso(),
            sentDate: existing.quote.sentDate ?? todayIso(),
          },
        });
      }
      // Moving to afronding readies a draft invoice with derived totals.
      if (status === "afronding" && existing.invoice && existing.quote) {
        const totals = deriveInvoiceTotals(
          existing.quote.amount,
          existing.quote.lineItems,
        );
        await tx.invoice.update({
          where: { id: existing.invoice.id },
          data: {
            ...totals,
            status:
              existing.invoice.status === "not_started"
                ? "draft"
                : existing.invoice.status,
          },
        });
      }
      await tx.project.update({ where: { id: existing.id }, data });
      await appendActivity(
        tx,
        user,
        existing.id,
        "status_change",
        `Status van ${STATUS_LABELS[fromStatus]} naar ${STATUS_LABELS[status]}`,
        { fromStatus, toStatus: status },
      );
      await audit(tx, user, "project.status", "project", existing.id, {
        fromStatus,
        toStatus: status,
      });
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// POST /:id/stage — admin. {stage} or {advance:true}. setStage semantics.
projectsRouter.post(
  "/:id/stage",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = stageSchema_.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: { quote: { include: { lineItems: true } }, invoice: true },
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
      // When stage="done" and invoice not_started, set invoice draft + totals.
      if (
        stage === "done" &&
        existing.invoice?.status === "not_started" &&
        existing.quote
      ) {
        const totals = deriveInvoiceTotals(
          existing.quote.amount,
          existing.quote.lineItems,
        );
        await tx.invoice.update({
          where: { id: existing.invoice.id },
          data: { ...totals, status: "draft" },
        });
      }
      await tx.project.update({
        where: { id: existing.id },
        data: { stage, status },
      });
      await appendActivity(
        tx,
        user,
        existing.id,
        "system",
        `Fase gewijzigd naar ${stage}`,
      );
      await audit(tx, user, "project.stage", "project", existing.id, { stage });
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// POST /:id/materials/check — admin. Mirror moveToMaterialsCheck.
projectsRouter.post(
  "/:id/materials/check",
  requireRole("admin"),
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
          blocker: available
            ? null
            : existing.blocker ?? "Niet alle materialen zijn beschikbaar.",
          nextStep: available ? "Project plannen" : "Inkooplijst maken",
          status: "operatie",
          urgency: available ? existing.urgency : "blocked",
        },
      });
      if (fromStatus !== "operatie") {
        await appendActivity(
          tx,
          user,
          existing.id,
          "status_change",
          "Materialencheck gestart",
          { fromStatus, toStatus: "operatie" },
        );
      }
      await audit(tx, user, "project.materialsCheck", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// =========================================================================
// INTAKE
// =========================================================================

// PATCH /:id/intake — admin. Update intake fields.
projectsRouter.patch(
  "/:id/intake",
  requireRole("admin"),
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

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// POST /:id/intake/complete — admin. Mirror completeIntake.
projectsRouter.post(
  "/:id/intake/complete",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const data = completeIntakeSchema.parse(req.body);
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: {
        intake: true,
        quote: { include: { lineItems: true } },
      },
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

      // Prepare a draft quote from type + m² if there are no lines yet.
      let value = existing.value;
      if (existing.quote && existing.quote.lineItems.length === 0) {
        // deriveQuoteLineItems only reads project.id; pass a minimal stub.
        const derived = deriveQuoteLineItems(
          { id: existing.id } as Parameters<typeof deriveQuoteLineItems>[0],
          {
            estimatedLaborHours:
              data.estimatedLaborHours !== undefined
                ? clampNumber(data.estimatedLaborHours)
                : existing.intake!.estimatedLaborHours,
            insulationType,
            squareMeters,
          },
        );
        let ordinal = 0;
        for (const line of derived) {
          await tx.quoteLineItem.create({
            data: {
              quoteId: existing.quote.id,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              ordinal: ordinal++,
            },
          });
        }
        value = await recalcQuoteAmount(tx, existing.quote.id);
      }

      await tx.project.update({
        where: { id: existing.id },
        data: {
          insulationType,
          squareMeters,
          blocker: blocker ?? existing.blocker,
          urgency: blocker ? "blocked" : existing.urgency,
          nextStep: blocker ? "Blokkade afhandelen" : "Offerte versturen",
          value,
        },
      });

      await appendActivity(
        tx,
        user,
        existing.id,
        "system",
        blocker ? `Intake afgerond met blokkade: ${blocker}` : "Intake afgerond",
      );
      await audit(tx, user, "project.intake.complete", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// =========================================================================
// QUOTE LINE ITEMS
// =========================================================================

async function loadQuote(user: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: projectScopeWhere(user, { id: projectId }),
    include: { quote: true },
  });
  if (!project) throw NotFound("Project not found");
  if (!project.quote) throw NotFound("Quote not found");
  return { project, quote: project.quote };
}

async function reloadProject(user: AuthUser, projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: projectInclude,
  });
  return projectDto(p, user.role as UserRole);
}

// POST /:id/quote/lines — add blank or from body. admin.
projectsRouter.post(
  "/:id/quote/lines",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addQuoteLineSchema.parse(req.body) ?? {};
    const { project, quote } = await loadQuote(user, req.params.id);

    await prisma.$transaction(async (tx) => {
      const count = await tx.quoteLineItem.count({ where: { quoteId: quote.id } });
      await tx.quoteLineItem.create({
        data: {
          quoteId: quote.id,
          description:
            input.description !== undefined ? clampText(input.description) : "",
          werksoort: input.werksoort
            ? clampText(input.werksoort)
            : "Warme leidingisolatie",
          size: input.size !== undefined ? clampText(input.size) : "",
          quantity: input.quantity !== undefined ? clampNumber(input.quantity) : 1,
          unit: input.unit ? clampText(input.unit) : "m",
          unitPrice:
            input.unitPrice !== undefined ? clampNumber(input.unitPrice) : 0,
          ordinal: count,
        },
      });
      await recalcQuoteAmount(tx, quote.id);
      await audit(tx, user, "project.quote.line.add", "project", project.id);
    });

    res.status(201).json(await reloadProject(user, project.id));
  }),
);

// POST /:id/quote/from-catalog — add a line from an Article. admin.
projectsRouter.post(
  "/:id/quote/from-catalog",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = quoteFromCatalogSchema.parse(req.body);
    const { project, quote } = await loadQuote(user, req.params.id);

    const article = await prisma.article.findFirst({
      where: { id: input.catalogItemId, orgId: user.orgId },
    });
    if (!article) throw BadRequest("Article not found in organization");

    await prisma.$transaction(async (tx) => {
      const count = await tx.quoteLineItem.count({ where: { quoteId: quote.id } });
      await tx.quoteLineItem.create({
        data: {
          quoteId: quote.id,
          catalogItemId: article.id,
          description: article.name,
          quantity:
            input.quantity !== undefined
              ? clampNumber(input.quantity)
              : article.defaultQuantity,
          unit: article.unit,
          unitPrice: article.unitPrice,
          ordinal: count,
        },
      });
      await recalcQuoteAmount(tx, quote.id);
      // Keep accepted quotes accepted; otherwise draft (mirror store).
      if (quote.status !== "accepted") {
        await tx.quote.update({
          where: { id: quote.id },
          data: { status: "draft" },
        });
      }
      await audit(tx, user, "project.quote.line.catalog", "project", project.id, {
        catalogItemId: article.id,
      });
    });

    res.status(201).json(await reloadProject(user, project.id));
  }),
);

// PATCH /:id/quote/lines/:lineId — admin.
projectsRouter.patch(
  "/:id/quote/lines/:lineId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = updateQuoteLineSchema.parse(req.body);
    const { project, quote } = await loadQuote(user, req.params.id);

    const line = await prisma.quoteLineItem.findFirst({
      where: { id: req.params.lineId, quoteId: quote.id },
    });
    if (!line) throw NotFound("Quote line not found");

    const data: Prisma.QuoteLineItemUpdateInput = {};
    if (input.description !== undefined)
      data.description = clampText(input.description);
    if (input.werksoort !== undefined) data.werksoort = clampText(input.werksoort);
    if (input.size !== undefined) data.size = clampText(input.size);
    if (input.quantity !== undefined) data.quantity = clampNumber(input.quantity);
    if (input.unit !== undefined) data.unit = clampText(input.unit);
    if (input.unitPrice !== undefined)
      data.unitPrice = clampNumber(input.unitPrice);

    await prisma.$transaction(async (tx) => {
      await tx.quoteLineItem.update({ where: { id: line.id }, data });
      await recalcQuoteAmount(tx, quote.id);
      await audit(tx, user, "project.quote.line.update", "project", project.id, {
        lineId: line.id,
      });
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// DELETE /:id/quote/lines/:lineId — admin.
projectsRouter.delete(
  "/:id/quote/lines/:lineId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, quote } = await loadQuote(user, req.params.id);
    const line = await prisma.quoteLineItem.findFirst({
      where: { id: req.params.lineId, quoteId: quote.id },
    });
    if (!line) throw NotFound("Quote line not found");

    await prisma.$transaction(async (tx) => {
      await tx.quoteLineItem.delete({ where: { id: line.id } });
      await recalcQuoteAmount(tx, quote.id);
      await audit(tx, user, "project.quote.line.delete", "project", project.id, {
        lineId: line.id,
      });
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/quote/apply-norm-prices — fill unitPrice where 0. admin.
projectsRouter.post(
  "/:id/quote/apply-norm-prices",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, quote } = await loadQuote(user, req.params.id);
    const lines = await prisma.quoteLineItem.findMany({
      where: { quoteId: quote.id },
    });

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        if (line.unitPrice > 0) continue;
        await tx.quoteLineItem.update({
          where: { id: line.id },
          data: { unitPrice: normPriceFor(line.unit) },
        });
      }
      await recalcQuoteAmount(tx, quote.id);
      await audit(tx, user, "project.quote.normPrices", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/quote/send — admin. status sent, sentDate today.
projectsRouter.post(
  "/:id/quote/send",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, quote } = await loadQuote(user, req.params.id);

    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "sent", sentDate: quote.sentDate ?? todayIso() },
      });
      await tx.project.update({
        where: { id: project.id },
        data: { nextStep: "Wachten op akkoord" },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        "system",
        "Offerte verstuurd naar klant",
      );
      await audit(tx, user, "project.quote.send", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/quote/accept — admin OR klant on own project. Mirror acceptQuote.
projectsRouter.post(
  "/:id/quote/accept",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: {
        quote: true,
        materialRequirements: true,
        installers: { select: { id: true } },
      },
    });
    if (!existing) throw NotFound("Project not found");
    if (!existing.quote) throw NotFound("Quote not found");

    // admin always; klant only on their own project (visibility already
    // enforces customer match, but gate explicitly to forbid monteur).
    if (user.role !== "admin") {
      if (user.role !== "klant" || existing.customerId !== user.customerId) {
        throw Forbidden("Not allowed to accept this quote");
      }
    }

    const reqs = existing.materialRequirements;
    const readiness =
      reqs.length === 0
        ? "needs_ordering"
        : reqs.every((r) => r.quantityInStock >= r.quantityNeeded)
          ? "available"
          : reqs.some(
                (r) =>
                  r.quantityInStock > 0 && r.quantityInStock < r.quantityNeeded,
              )
            ? "partly_available"
            : "needs_ordering";
    const available = readiness === "available";
    const fromStatus = existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: existing.quote!.id },
        data: { status: "accepted", acceptedDate: todayIso() },
      });
      await tx.project.update({
        where: { id: existing.id },
        data: {
          status: "operatie",
          blocker: available
            ? null
            : existing.blocker ?? "Niet alle materialen zijn beschikbaar.",
          nextStep: available ? "Project plannen" : "Inkooplijst maken",
          urgency: available ? existing.urgency : "blocked",
        },
      });
      if (fromStatus !== "operatie") {
        await appendActivity(
          tx,
          user,
          existing.id,
          "status_change",
          "Offerte geaccepteerd - project naar Operatie",
          { fromStatus, toStatus: "operatie" },
        );
      }
      await audit(tx, user, "project.quote.accept", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// =========================================================================
// URGENCY / BLOCKER / TEAM
// =========================================================================

// POST /:id/urgency — admin. {urgency} + activity.
projectsRouter.post(
  "/:id/urgency",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { urgency } = urgencyBodySchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);
    const label =
      urgency === "urgent"
        ? "Urgent"
        : urgency === "blocked"
          ? "Geblokkeerd"
          : "Normaal";

    const updated = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: { urgency },
      });
      await appendActivity(tx, user, existing.id, "system", `Urgentie: ${label}`);
      await audit(tx, user, "project.urgency", "project", existing.id, { urgency });
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// POST /:id/resolve-blocker — admin. {note?} + activity.
projectsRouter.post(
  "/:id/resolve-blocker",
  requireRole("admin"),
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
          urgency: existing.urgency === "blocked" ? "normal" : existing.urgency,
          nextStep: "Offerte versturen",
        },
      });
      await appendActivity(
        tx,
        user,
        existing.id,
        "system",
        `Blokkade afgehandeld: ${existing.blocker}${trimmed ? ` (${trimmed})` : ""}`,
      );
      await audit(tx, user, "project.resolveBlocker", "project", existing.id);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
  }),
);

// POST /:id/team — admin. Set project leader / team leader / installers.
projectsRouter.post(
  "/:id/team",
  requireRole("admin"),
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
      await audit(tx, user, "project.team", "project", existing.id, input);
      return tx.project.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectInclude,
      });
    });

    res.json(projectDto(updated, user.role as UserRole));
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

// POST /:id/comments — admin + monteur (assigned) + klant (own).
projectsRouter.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { body } = commentSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);
    // loadProjectForUser already enforces visibility; canViewProject is the
    // same gate for clarity (admin: any, klant: own, monteur: assigned).
    if (!canViewProject(user, existing)) {
      throw Forbidden("Not allowed to comment on this project");
    }
    const trimmed = clampText(body).trim();
    if (!trimmed) throw BadRequest("Empty comment");

    await prisma.$transaction(async (tx) => {
      await appendActivity(tx, user, existing.id, "comment", trimmed);
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

// =========================================================================
// MEERWERK
// =========================================================================

// POST /:id/meerwerk — admin + monteur (assigned) may create. Mirror addMeerwerk.
projectsRouter.post(
  "/:id/meerwerk",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const input = addMeerwerkSchema.parse(req.body);
    const existing = await loadProjectForUser(user, req.params.id);
    // admin or monteur-on-assigned (klant may not create meerwerk).
    if (user.role !== "admin") {
      if (user.role !== "monteur" || !canViewProject(user, existing)) {
        throw Forbidden("Not allowed to add meerwerk to this project");
      }
    }

    const name = clampText(input.name).trim();
    if (!name) throw BadRequest("Name required");
    const quantity = input.quantity !== undefined ? clampNumber(input.quantity) : 0;
    const unit = input.unit ? clampText(input.unit).trim() : "";
    const unitPrice = input.unitPrice ? clampNumber(input.unitPrice) : 0;
    const label = input.label ? clampText(input.label).trim() : null;
    const description = label || `${quantity} ${unit} ${name}`.trim();
    const amount = Math.round(quantity * unitPrice);
    // TODO(Phase 7): real upload — placeholder filename for now.
    const photos = input.photo ? [`meerwerk-${Date.now()}.jpg`] : [];

    await prisma.$transaction(async (tx) => {
      await tx.meerwerk.create({
        data: {
          projectId: existing.id,
          description,
          label,
          name,
          quantity,
          unit,
          diameter: input.diameter ? clampNumber(input.diameter) : null,
          unitPrice,
          amount,
          photos,
          createdAt: todayIso(),
        },
      });
      await appendActivity(
        tx,
        user,
        existing.id,
        "system",
        `Meerwerk gemeld: ${description} (${formatEuro(amount)})`,
      );
      await audit(tx, user, "project.meerwerk.add", "project", existing.id);
    });

    res.status(201).json(await reloadProject(user, existing.id));
  }),
);

// Load a meerwerk row scoped to a visible project.
async function loadMeerwerk(user: AuthUser, projectId: string, mwId: string) {
  const project = await loadProjectForUser(user, projectId);
  const item = await prisma.meerwerk.findFirst({
    where: { id: mwId, projectId: project.id },
  });
  if (!item) throw NotFound("Meerwerk not found");
  return { project, item };
}

// POST /:id/meerwerk/:mwId/approve-office — admin. Toggle. Mirror store.
projectsRouter.post(
  "/:id/meerwerk/:mwId/approve-office",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.mwId);
    const next = !item.approvedByOffice;

    await prisma.$transaction(async (tx) => {
      await tx.meerwerk.update({
        where: { id: item.id },
        data: { approvedByOffice: next, rejected: false },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        "system",
        `Meerwerk "${item.description}": kantoor ${next ? "akkoord" : "akkoord ingetrokken"}`,
      );
      await audit(tx, user, "project.meerwerk.approveOffice", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/meerwerk/:mwId/approve-client — admin OR klant on own. Toggle.
projectsRouter.post(
  "/:id/meerwerk/:mwId/approve-client",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.mwId);
    if (user.role !== "admin") {
      if (user.role !== "klant" || project.customerId !== user.customerId) {
        throw Forbidden("Not allowed to approve this meerwerk");
      }
    }
    const next = !item.approvedByClient;

    await prisma.$transaction(async (tx) => {
      await tx.meerwerk.update({
        where: { id: item.id },
        data: { approvedByClient: next, rejected: false },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        "system",
        `Meerwerk "${item.description}": opdrachtgever ${next ? "akkoord" : "akkoord ingetrokken"}`,
      );
      await audit(tx, user, "project.meerwerk.approveClient", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/meerwerk/:mwId/reject — admin. {by?}. Mirror rejectMeerwerk.
projectsRouter.post(
  "/:id/meerwerk/:mwId/reject",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { by } = rejectMeerwerkSchema.parse(req.body);
    const rejectedBy = by ?? "office";
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.mwId);

    await prisma.$transaction(async (tx) => {
      await tx.meerwerk.update({
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
        "system",
        `Meerwerk "${item.description}": afgewezen door ${rejectedBy === "client" ? "opdrachtgever" : "kantoor"}`,
      );
      await audit(tx, user, "project.meerwerk.reject", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/meerwerk/:mwId/toggle-done — admin. Mirror toggleMeerwerkDone.
projectsRouter.post(
  "/:id/meerwerk/:mwId/toggle-done",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, item } = await loadMeerwerk(user, req.params.id, req.params.mwId);
    const next = !item.done;

    await prisma.$transaction(async (tx) => {
      await tx.meerwerk.update({ where: { id: item.id }, data: { done: next } });
      await appendActivity(
        tx,
        user,
        project.id,
        "system",
        `Meerwerk "${item.description}": ${next ? "afgerond" : "heropend"}`,
      );
      await audit(tx, user, "project.meerwerk.toggleDone", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// =========================================================================
// OPLEVERING — admin + monteur (assigned)
// =========================================================================

// Gate oplevering writes to admin or monteur-on-assigned.
function assertOpleveringWriter(
  user: AuthUser,
  project: {
    customerId: string;
    teamLeaderId: string | null;
    projectLeaderId: string | null;
    installers?: { id: string }[];
  },
) {
  if (user.role === "admin") return;
  if (user.role === "monteur" && canViewProject(user, project)) return;
  throw Forbidden("Not allowed for this oplevering");
}

// POST /:id/oplevering/init — create checklist if absent. Mirror initOplevering.
projectsRouter.post(
  "/:id/oplevering/init",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existing = await prisma.project.findFirst({
      where: projectScopeWhere(user, { id: req.params.id }),
      include: {
        oplevering: { include: { checklist: true } },
        installers: { select: { id: true } },
      },
    });
    if (!existing) throw NotFound("Project not found");
    assertOpleveringWriter(user, existing);

    if (existing.oplevering && existing.oplevering.checklist.length > 0) {
      return res.json(await reloadProject(user, existing.id));
    }

    const items = [
      { label: "Werk uitgevoerd volgens opdracht", ordinal: 0 },
      { label: "Voor- en na-foto's gemaakt", ordinal: 1 },
      { label: "Brandwerende doorvoeringen geregistreerd", ordinal: 2 },
      { label: "Meerwerk afgestemd en akkoord", ordinal: 3 },
      { label: "Werkplek opgeruimd opgeleverd", ordinal: 4 },
      { label: "Kwaliteitscontrole akkoord", ordinal: 5 },
    ];

    await prisma.$transaction(async (tx) => {
      if (existing.oplevering) {
        await tx.opleverItem.createMany({
          data: items.map((i) => ({ ...i, opleveringId: existing.oplevering!.id })),
        });
      } else {
        await tx.oplevering.create({
          data: {
            projectId: existing.id,
            checklist: { create: items },
          },
        });
      }
      await audit(tx, user, "project.oplevering.init", "project", existing.id);
    });

    res.json(await reloadProject(user, existing.id));
  }),
);

// Load oplevering scoped to a visible project, with writer gate.
async function loadOplevering(user: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: projectScopeWhere(user, { id: projectId }),
    include: { oplevering: true, installers: { select: { id: true } } },
  });
  if (!project) throw NotFound("Project not found");
  assertOpleveringWriter(user, project);
  if (!project.oplevering) throw NotFound("Oplevering not found");
  return { project, oplevering: project.oplevering };
}

// POST /:id/oplevering/items/:itemId/toggle.
projectsRouter.post(
  "/:id/oplevering/items/:itemId/toggle",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, oplevering } = await loadOplevering(user, req.params.id);
    const item = await prisma.opleverItem.findFirst({
      where: { id: req.params.itemId, opleveringId: oplevering.id },
    });
    if (!item) throw NotFound("Oplever item not found");

    await prisma.$transaction(async (tx) => {
      await tx.opleverItem.update({
        where: { id: item.id },
        data: { done: !item.done },
      });
      await audit(tx, user, "project.oplevering.toggle", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/oplevering/photo — placeholder filename. Mirror addOpleverPhoto.
projectsRouter.post(
  "/:id/oplevering/photo",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { project, oplevering } = await loadOplevering(user, req.params.id);
    // TODO(Phase 7): real upload — placeholder filename for now.
    const filename = `oplevering-${Date.now()}.jpg`;

    await prisma.$transaction(async (tx) => {
      await tx.oplevering.update({
        where: { id: oplevering.id },
        data: { photos: { push: filename } },
      });
      await audit(tx, user, "project.oplevering.photo", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// PATCH /:id/oplevering/restpunten — {restpunten}.
projectsRouter.patch(
  "/:id/oplevering/restpunten",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { restpunten } = restpuntenSchema.parse(req.body);
    const { project, oplevering } = await loadOplevering(user, req.params.id);

    await prisma.$transaction(async (tx) => {
      await tx.oplevering.update({
        where: { id: oplevering.id },
        data: { restpunten: clampText(restpunten) },
      });
      await audit(tx, user, "project.oplevering.restpunten", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);

// POST /:id/oplevering/sign — {signedBy}. Mirror signOplevering.
projectsRouter.post(
  "/:id/oplevering/sign",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { signedBy } = signOpleveringSchema.parse(req.body);
    const { project, oplevering } = await loadOplevering(user, req.params.id);
    const name = clampText(signedBy).trim();
    if (!name) throw BadRequest("signedBy required");

    await prisma.$transaction(async (tx) => {
      await tx.oplevering.update({
        where: { id: oplevering.id },
        data: { signedBy: name, completedAt: todayIso() },
      });
      await appendActivity(
        tx,
        user,
        project.id,
        "system",
        `Oplevering ondertekend door ${name}`,
      );
      await audit(tx, user, "project.oplevering.sign", "project", project.id);
    });

    res.json(await reloadProject(user, project.id));
  }),
);
