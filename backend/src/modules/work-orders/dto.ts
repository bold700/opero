import type { ExtraWork, TaskMaterial, WorkOrder, WorkOrderTask } from "@prisma/client";
import {
  canSeePrices,
  canSeeMargin,
  type UserRole,
  normalizePrejobCheck,
  isPrejobChecklistComplete,
  canDispatch,
} from "@opero/shared";
import { photoRefs, photoUrl } from "../../lib/photoUrls.js";

// DTO mappers — never return raw rows with internal columns to clients.
//
// CRITICAL: technicians (and any role where canSeePrices(role) === false) must
// not see prices. On TaskMaterial that means stripping `unitPrice` (the only
// money field on the shared line-item row); there are no other derived totals
// exposed here — project.value lives on the project DTO, not the workOrder DTO.
//
// COST/MARGIN is stricter: only admins (canSeeMargin) see `costPrice`, `margin`
// and `marginPct`. Clients get the selling price but NEVER the cost/margin.
// Three-way on the billable line: technician→none, client→sell, admin→sell+margin.

// The variant's material + size — carried only so the client's edit dialog can
// pre-select the current article in its material→size→variant cascade. Ids/size
// only; never any price data.
type VariantRef = { variantMaterialId: string; variantSize: string } | null;
type MaterialWithVariant = TaskMaterial & { variant: { materialId: string; size: string } | null };
type ExtraWorkWithVariant = ExtraWork & { variant: { materialId: string; size: string } | null };

// A task loaded with its materials + the per-zone work type / assignee names.
type TaskWithRelations = WorkOrderTask & {
  materials: MaterialWithVariant[];
  workType?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
};

// Shape of a workOrder loaded with its nested tasks → materials, plus the
// signer (for the sign-off display).
export type WorkOrderWithRelations = WorkOrder & {
  tasks: TaskWithRelations[];
  extraWork?: ExtraWorkWithVariant[];
  signedBy?: { name: string } | null;
  assignees?: { id: string; name: string }[];
};

// Pull the material+size off the (optionally-loaded) variant relation, for
// edit-dialog prefill. Undefined for free-text rows or when not loaded.
function variantRef(v: { materialId: string; size: string } | null | undefined): VariantRef {
  return v ? { variantMaterialId: v.materialId, variantSize: v.size } : null;
}

function materialDto(m: MaterialWithVariant, showPrices: boolean, showMargin: boolean) {
  // Margin (admin-only): per-line profit = (sell − cost) × qty, plus the % of
  // the selling total. Only when BOTH prices are known. Cost/margin are never
  // included for non-admins, even the raw costPrice.
  const marginFields =
    showMargin && m.unitPrice != null && m.costPrice != null
      ? (() => {
          const sellTotal = m.unitPrice * m.quantity;
          const costTotal = m.costPrice * m.quantity;
          const margin = sellTotal - costTotal;
          return {
            costPrice: m.costPrice,
            margin,
            marginPct: sellTotal > 0 ? (margin / sellTotal) * 100 : 0,
          };
        })()
      : showMargin
        ? { costPrice: m.costPrice ?? undefined }
        : {};
  return {
    id: m.id,
    taskId: m.taskId,
    label: m.label ?? undefined,
    name: m.name,
    quantity: m.quantity,
    usedQuantity: m.usedQuantity ?? undefined,
    unit: m.unit,
    diameter: m.diameter ?? undefined,
    // Set when the line was picked from the materials catalog.
    variantId: m.variantId ?? undefined,
    // Material + size of the current variant, so the edit dialog can pre-select
    // it. Ids/size only, no price — safe for every role.
    ...(variantRef(m.variant) ?? {}),
    // Price stripped for technicians / non-price roles.
    ...(showPrices ? { unitPrice: m.unitPrice ?? undefined } : {}),
    // Cost/margin: admins only (see canSeeMargin). Never for clients.
    ...marginFields,
    onSite: m.onSite,
    done: m.done,
    note: m.note ?? undefined,
    ordinal: m.ordinal,
  };
}

async function taskDto(t: TaskWithRelations, showPrices: boolean, showMargin: boolean) {
  // Photo arrays hold object keys → resolve to {key, url} for the client.
  const [beforePhotos, resultPhotos] = await Promise.all([
    photoRefs(t.beforePhotos),
    photoRefs(t.resultPhotos),
  ]);
  return {
    id: t.id,
    workOrderId: t.workOrderId,
    description: t.description,
    done: t.done,
    day: t.day ?? undefined,
    // Per-zone work type + assignee (id for the dropdown, name for display).
    workTypeId: t.workTypeId ?? undefined,
    workTypeName: t.workType?.name ?? undefined,
    assigneeId: t.assigneeId ?? undefined,
    assigneeName: t.assignee?.name ?? undefined,
    beforePhotos,
    resultPhotos,
    startedAt: t.startedAt ?? undefined,
    endedAt: t.endedAt ?? undefined,
    hours: t.hours ?? undefined,
    note: t.note ?? undefined,
    ordinal: t.ordinal,
    materials: [...t.materials]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((m) => materialDto(m, showPrices, showMargin)),
  };
}

// Meerwerk (extra work) line, per-WERKBON. Prices (unitPrice + amount) are
// stripped for non-price roles, mirroring the task-material three-way rule.
// Photos hold object keys → resolved to {key, url} for the client.
async function extraWorkDto(m: ExtraWorkWithVariant, showPrices: boolean, showMargin: boolean) {
  const photos = await photoRefs(m.photos);
  // Cost/margin are admin-only, same as task lines. Never leak costPrice below.
  const margin =
    showMargin && m.unitPrice != null && m.costPrice != null && m.quantity != null
      ? {
          costPrice: m.costPrice,
          margin: (m.unitPrice - m.costPrice) * m.quantity,
        }
      : {};
  return {
    id: m.id,
    description: m.description,
    label: m.label ?? undefined,
    name: m.name ?? undefined,
    quantity: m.quantity ?? undefined,
    unit: m.unit ?? undefined,
    diameter: m.diameter ?? undefined,
    // A trace id only (no price) — safe for every role.
    variantId: m.variantId ?? undefined,
    // Material + size, so the edit dialog can pre-select the article.
    ...(variantRef(m.variant) ?? {}),
    ...(showPrices ? { unitPrice: m.unitPrice ?? undefined, amount: m.amount } : {}),
    ...margin,
    photos,
    createdAt: m.createdAt,
    done: m.done,
    approvedByOffice: m.approvedByOffice,
    approvedByClient: m.approvedByClient,
    rejected: m.rejected,
    rejectedBy: m.rejectedBy ?? undefined,
  };
}

// Full nested workOrder DTO. Takes the requesting role + the org's hide-prices
// flag so prices are stripped for technicians when the org enables that privacy
// setting (admins/clients always see prices).
export async function workOrderDto(
  wb: WorkOrderWithRelations,
  role: UserRole,
  hidePrices: boolean,
) {
  const showPrices = canSeePrices(role, hidePrices);
  const showMargin = canSeeMargin(role);
  const sortedTasks = [...wb.tasks].sort((a, b) => a.ordinal - b.ordinal);
  const [drawings, signatureUrl, prejobPhotos, tasks, extraWork] = await Promise.all([
    photoRefs(wb.drawings),
    photoUrl(wb.signature),
    photoRefs(wb.prejobPhotos),
    Promise.all(sortedTasks.map((t) => taskDto(t, showPrices, showMargin))),
    Promise.all((wb.extraWork ?? []).map((m) => extraWorkDto(m, showPrices, showMargin))),
  ]);
  const prejobCheck = normalizePrejobCheck(wb.prejobCheck);
  return {
    id: wb.id,
    projectId: wb.projectId,
    title: wb.title,
    drawings,
    approvedBySupervisor: wb.approvedBySupervisor,
    ordinal: wb.ordinal,
    // Pre-job check + dispatch gate.
    prejobCheck,
    prejobPhotos,
    prejobComplete: isPrejobChecklistComplete(prejobCheck),
    canDispatch: canDispatch(prejobCheck, wb.prejobPhotos.length),
    dispatchedAt: wb.dispatchedAt ? wb.dispatchedAt.toISOString() : undefined,
    // Per-work-order sign-off state. `signature` is the stored object key;
    // `signatureUrl` is the renderable URL. `signedByName` is the name typed at
    // sign-off (often the customer's), falling back to the signing user's name.
    signature: wb.signature ?? undefined,
    signatureUrl,
    signedAt: wb.signedAt ? wb.signedAt.toISOString() : undefined,
    signedByName: wb.signedByName ?? wb.signedBy?.name ?? undefined,
    // The monteur(s) assigned to this werkbon (werkbon-level, not per-zone).
    assignees: (wb.assignees ?? []).map((a) => ({ id: a.id, name: a.name })),
    // The werkbon is the scheduled visit — its own date(s).
    plannedDate: wb.plannedDate ?? undefined,
    plannedEndDate: wb.plannedEndDate ?? undefined,
    tasks,
    // Meerwerk (extra work) is per-WERKBON; prices stripped for non-price roles.
    extraWork,
  };
}

// Prisma include used to load the full workOrder aggregate (tasks → materials,
// plus the signer's name for the sign-off display).
export const workOrderInclude = {
  tasks: {
    include: {
      materials: {
        include: { variant: { select: { materialId: true, size: true } } },
      },
      workType: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  },
  extraWork: {
    orderBy: { createdAt: "asc" },
    include: { variant: { select: { materialId: true, size: true } } },
  },
  signedBy: { select: { name: true } },
  assignees: { select: { id: true, name: true } },
} as const;

// --- List view ------------------------------------------------------------
// The work-orders list (per the Figma) shows one row per work order with its
// project context: number, customer, location, work type, technician, status,
// date. Status is derived from urgency + task completion.

import { type WorkOrderListStatus } from "./status.js";
export type { WorkOrderListStatus };

type WorkOrderListSource = WorkOrder & {
  // Persisted, denormalized status (see WorkOrder.listStatus + status.ts).
  listStatus: string;
  // Technicians are werkbon-level (a crew per job), not per-zone.
  assignees: { name: string }[];
  tasks: {
    done: boolean;
    startedAt: string | null;
    // Work type is DERIVED from the line articles' materials (no per-zone input).
    materials: { variant: { material: { name: string } } | null }[];
  }[];
  project: {
    projectNumber: string;
    customerName: string;
    city: string;
    insulationType: string;
    urgency: string;
    teamLeader: { name: string } | null;
  };
};

// Roll up distinct task-level names; "+N" when more than one. Falls back to the
// project-level value when no task carries one (older / empty work orders).
function rollup(
  names: (string | null | undefined)[],
  fallback: string | null,
): string {
  const distinct = [...new Set(names.filter((n): n is string => !!n))];
  if (distinct.length === 0) return fallback ?? "—";
  if (distinct.length === 1) return distinct[0];
  return `${distinct[0]} +${distinct.length - 1}`;
}

export const workOrderListInclude = {
  assignees: { select: { name: true } },
  tasks: {
    select: {
      done: true,
      startedAt: true,
      // Pull each line's material name to derive the werkbon's work type(s).
      materials: {
        select: { variant: { select: { material: { select: { name: true } } } } },
      },
    },
  },
  project: {
    select: {
      projectNumber: true,
      customerName: true,
      city: true,
      insulationType: true,
      urgency: true,
      teamLeader: { select: { name: true } },
    },
  },
} as const;

export function workOrderListDto(wb: WorkOrderListSource) {
  return {
    id: wb.id,
    number: wb.project.projectNumber,
    customerName: wb.project.customerName,
    city: wb.project.city,
    // Work type is DERIVED from the distinct material names across all the
    // werkbon's lines (the article implies the work type), falling back to the
    // project's insulationType when the werkbon has no catalog lines yet.
    workType: rollup(
      wb.tasks.flatMap((t) => t.materials.map((m) => m.variant?.material.name)),
      wb.project.insulationType,
    ),
    // Technician column rolls up the werkbon's assigned monteur(s); falls back
    // to the project team leader when none are assigned yet.
    technician: rollup(
      wb.assignees.map((a) => a.name),
      wb.project.teamLeader?.name ?? null,
    ),
    // Read the denormalized column (kept in sync by recomputeWorkOrderStatus).
    status: wb.listStatus as WorkOrderListStatus,
    date: wb.createdAt.toISOString(),
  };
}
