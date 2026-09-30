import type { ProjectAttachment, TaskMaterial, WorkOrder, WorkOrderTask, WorkOrderAttachment, WorkOrderPrejobItem, WorkOrderRequirement } from "@prisma/client";
import {
  canSeePrices,
  canSeeMargin,
  type UserRole,
  isPrejobChecklistComplete,
  canDispatch,
  workOrderPhaseForStatus,
  type WorkOrderStatus,
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
type MaterialWithVariant = TaskMaterial & {
  variant: { materialId: string; size: string } | null;
  progressEntries?: {
    id: string;
    amount: number;
    day: string;
    employee?: { name: string } | null;
  }[];
};

// A task loaded with its materials + the per-zone work type / assignee names.
type TaskWithRelations = WorkOrderTask & {
  materials: MaterialWithVariant[];
  workType?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  hoursEmployee?: { id: string; name: string } | null;
};

// The customer's contact details, carried on the werkbon so a monteur on site
// can reach someone without leaving the screen. Read-only here: the customer
// record is edited under /customers. `contactPersons` is the customer's
// multi-contact list (name + optional role/phone/email).
type CustomerContactSource = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  contactPersons?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }[];
  sharedContactPersons?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }[];
};

// Shape of a workOrder loaded with its nested tasks → materials, plus the
// signer (for the sign-off display).
export type WorkOrderWithRelations = WorkOrder & {
  tasks: TaskWithRelations[];
  attachments?: WorkOrderAttachment[];
  requirements?: WorkOrderRequirement[];
  prejobItems?: WorkOrderPrejobItem[];
  signedBy?: { name: string } | null;
  assignees?: { id: string; name: string }[];
  // The werkbon's calendar slot (one per werkbon; multi-day = one slot on the
  // start date + plannedEndDate). Carries the visit's times for the detail.
  planningItems?: { startTime: string; endTime: string }[];
  invoice?: { status: string } | null;
  contacts?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }[];
  // Present when loaded via workOrderInclude — the parent project's customer
  // (for the technician's contact block) and the project-level files.
  project?: {
    customer?: CustomerContactSource | null;
    attachments?: ProjectAttachment[];
  } | null;
};

// Map the parent project's customer onto the werkbon payload. Contact data
// only — no financial or administrative customer fields.
function customerContactDto(c: CustomerContactSource) {
  const contacts = [...(c.contactPersons ?? []), ...(c.sharedContactPersons ?? [])];
  return {
    id: c.id,
    name: c.name,
    contactName: c.contactName || undefined,
    email: c.email || undefined,
    phone: c.phone || undefined,
    contactPersons: [...new Map(contacts.map((p) => [p.id, p])).values()].map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? undefined,
      phone: p.phone ?? undefined,
      role: p.role ?? undefined,
    })),
  };
}

// Pull the material+size off the (optionally-loaded) variant relation, for
// edit-dialog prefill. Undefined for free-text rows or when not loaded.
function variantRef(v: { materialId: string; size: string } | null | undefined): VariantRef {
  return v ? { variantMaterialId: v.materialId, variantSize: v.size } : null;
}

async function materialDto(m: MaterialWithVariant, showPrices: boolean, showMargin: boolean) {
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
    issuedQuantity: m.issuedQuantity ?? undefined,
    returnedQuantity: m.returnedQuantity ?? undefined,
    // Per-day progress log (who advanced how much on which day). The total is
    // the sum of entries — derived here, never stored.
    progressTotal: (m.progressEntries ?? []).reduce((s, e) => s + e.amount, 0),
    progressEntries: (m.progressEntries ?? []).map((e) => ({
      id: e.id,
      amount: e.amount,
      day: e.day,
      employeeName: e.employee?.name ?? undefined,
    })),
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
    requirementDone: m.requirementDone,
    done: m.done,
    note: m.note ?? undefined,
    ordinal: m.ordinal,
    // --- Meerwerk ---------------------------------------------------------
    // Only meaningful when isExtraWork; the approval flags decide whether this
    // line reaches the invoice at all (see deriveTotals).
    isExtraWork: m.isExtraWork,
    ...(m.isExtraWork
      ? {
          approvedByOffice: m.approvedByOffice,
          approvedByClient: m.approvedByClient,
          rejected: m.rejected,
          rejectedBy: m.rejectedBy ?? undefined,
          photos: await photoRefs(m.photos),
        }
      : {}),
  };
}

async function taskDto(t: TaskWithRelations, showPrices: boolean, showMargin: boolean) {
  // Photo arrays hold object keys → resolve to {key, url} for the client.
  const [beforePhotos, resultPhotos, materials] = await Promise.all([
    photoRefs(t.beforePhotos),
    photoRefs(t.resultPhotos),
    Promise.all(
      [...t.materials]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((m) => materialDto(m, showPrices, showMargin)),
    ),
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
    hoursEmployeeName: t.hoursEmployee?.name ?? undefined,
    note: t.note ?? undefined,
    ordinal: t.ordinal,
    materials,
  };
}

// Full nested workOrder DTO. Prices are stripped for technicians (always —
// canSeePrices is absolute); admins/clients always see them.
export async function workOrderDto(wb: WorkOrderWithRelations, role: UserRole) {
  const showPrices = canSeePrices(role);
  const showMargin = canSeeMargin(role);
  const sortedTasks = [...wb.tasks].sort((a, b) => a.ordinal - b.ordinal);
  const [drawings, signatureUrl, prejobPhotos, tasks, attachments, projectAttachments] =
    await Promise.all([
      photoRefs(wb.drawings),
      photoUrl(wb.signature),
      photoRefs(wb.prejobPhotos),
      Promise.all(sortedTasks.map((t) => taskDto(t, showPrices, showMargin))),
      Promise.all(
        (wb.attachments ?? []).map(async (a) => ({
          id: a.id,
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          url: await photoUrl(a.key),
          kind: a.kind,
          receivedAt: a.receivedAt?.toISOString(),
          createdAt: a.createdAt.toISOString(),
        })),
      ),
      // The parent project's files — read-only from the werkbon (managed on
      // the project), so every visit sees the same reference documents.
      Promise.all(
        (wb.project?.attachments ?? []).map(async (a) => ({
          id: a.id,
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          url: await photoUrl(a.key),
          createdAt: a.createdAt.toISOString(),
        })),
      ),
    ]);
  // Per-werkbon checklist: this werkbon's OWN items (with `done`), ordered.
  const items = [...(wb.prejobItems ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const prejobItemKeys = items.map((i) => i.key);
  const prejobCheck: Record<string, boolean> = {};
  for (const it of items) if (it.done) prejobCheck[it.key] = true;
  const requirePhoto = wb.prejobPhotoRequired === true;
  return {
    id: wb.id,
    projectId: wb.projectId,
    title: wb.title,
    // THIS visit's own description. Independent of the project's — a project
    // groups many werkbonnen, each covering a different part of the job.
    description: wb.description ?? undefined,
    // The customer's contact details (phone/email + contact persons), so the
    // monteur on site can reach someone from the werkbon itself.
    customer: wb.project?.customer ? customerContactDto(wb.project.customer) : undefined,
    contactPersons: (wb.contacts ?? []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      role: contact.role ?? undefined,
    })),
    drawings,
    attachments,
    projectAttachments,
    approvedBySupervisor: wb.approvedBySupervisor,
    ordinal: wb.ordinal,
    // The werkbon's OWN derived status (same value the list shows) — the detail
    // header badge reads this, NOT the parent project's stage, which used to
    // masquerade as this werkbon's state.
    status: wb.listStatus,
    phase: workOrderPhaseForStatus(wb.listStatus as WorkOrderStatus),
    invoiceStatus: wb.invoice?.status ?? "not_started",
    // THIS visit's priority (per-werkbon; the sidebar edits it).
    urgency: wb.urgency,
    // Pre-job check + dispatch gate. `prejobItems` are THIS werkbon's items
    // (key + label + done), editable on the werkbon; snapshotted from the org
    // template at creation.
    prejobItems: items.map((i) => ({
      key: i.key,
      label: i.label,
      done: i.done,
      reminderEnabled: i.reminderEnabled,
      reminderTime: i.reminderTime ?? undefined,
      ordinal: i.ordinal,
      id: i.id,
    })),
    prejobCheck,
    prejobPhotos,
    prejobPhotoRequired: requirePhoto,
    prejobComplete: isPrejobChecklistComplete(prejobCheck, prejobItemKeys),
    canDispatch: canDispatch(prejobCheck, wb.prejobPhotos.length, prejobItemKeys, requirePhoto),
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
    // The werkbon is the scheduled visit — its own date(s), plus the visit's
    // times from its calendar slot (the store the Planning screen edits).
    plannedDate: wb.plannedDate ?? undefined,
    plannedEndDate: wb.plannedEndDate ?? undefined,
    startTime: wb.planningItems?.[0]?.startTime ?? undefined,
    endTime: wb.planningItems?.[0]?.endTime ?? undefined,
    tasks,
    requirements: [...(wb.requirements ?? [])]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        done: item.done,
        ordinal: item.ordinal,
      })),
    // Meerwerk (extra work) is per-WERKBON; prices stripped for non-price roles.
  };
}

// Prisma include used to load the full workOrder aggregate (tasks → materials,
// plus the signer's name for the sign-off display).
export const workOrderInclude = {
  tasks: {
    include: {
      materials: {
        include: {
          variant: { select: { materialId: true, size: true } },
          progressEntries: {
            orderBy: { day: "asc" as const },
            include: { employee: { select: { name: true } } },
          },
        },
      },
      workType: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      hoursEmployee: { select: { id: true, name: true } },
    },
  },
  attachments: { orderBy: { createdAt: "asc" } },
  requirements: { orderBy: { ordinal: "asc" } },
  prejobItems: { orderBy: { ordinal: "asc" } },
  signedBy: { select: { name: true } },
  contacts: {
    orderBy: { name: "asc" as const },
    select: { id: true, name: true, email: true, phone: true, role: true },
  },
  assignees: { select: { id: true, name: true } },
  planningItems: {
    orderBy: { date: "asc" as const },
    select: { startTime: true, endTime: true },
  },
  invoice: { select: { status: true } },
  // Customer CONTACT data only (name/phone/email + the contact-person list) —
  // the monteur needs to reach someone, not to read the customer's admin.
  project: {
    select: {
      customer: {
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
          phone: true,
          contactPersons: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
          sharedContactPersons: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
        },
      },
      // Project-level files are visible from every werkbon in the project.
      attachments: { orderBy: { createdAt: "asc" as const } },
    },
  },
} as const;

// --- List view ------------------------------------------------------------
// The work-orders list (per the Figma) shows one row per work order with its
// project context: number, customer, location, work type, technician, status,
// date. Status is derived from the werkbon's urgency + task completion.

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
      teamLeader: { select: { name: true } },
    },
  },
} as const;

export function workOrderListDto(wb: WorkOrderListSource) {
  return {
    id: wb.id,
    projectId: wb.projectId,
    number: wb.project.projectNumber,
    title: wb.title,
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
    phase: workOrderPhaseForStatus(wb.listStatus as WorkOrderStatus),
    createdAt: wb.createdAt.toISOString(),
    // Release state — the office's "which scheduled jobs haven't we sent out
    // yet" scan, and the reason a technician's row may be read-only. A separate
    // axis from `status` on purpose: progress and release are independent.
    dispatchedAt: wb.dispatchedAt ? wb.dispatchedAt.toISOString() : undefined,
    // WHEN THE WORK HAPPENS, not when the row was typed in. Null until the
    // werkbon is scheduled — the list renders that as "not planned", which is
    // the same answer the planning calendar gives (planning/routes.ts treats a
    // werkbon as on the calendar only once it has a plannedDate or a slot).
    date: wb.plannedDate ?? null,
  };
}
