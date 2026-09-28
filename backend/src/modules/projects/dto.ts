import type {
  DeliveryChecklist,
  DeliveryChecklistItem,
  Intake,
  MaterialRequirement,
  Handover,
  HandoverItem,
  Project,
  ProjectActivity,
  ProjectAttachment,
  ProjectTask,
} from "@prisma/client";
import {
  canSeePrices,
  deriveProjectLifecycleStatus,
  type ProjectLifecycleWorkOrder,
  type UserRole,
} from "@opero/shared";
import { refsFrom } from "../../lib/photoUrls.js";
import type { AuthUser } from "../../auth/types.js";
import { visibleWorkOrdersWhere } from "../work-orders/visibility.js";

// A synchronous key→url lookup, prebuilt in the route wrapper (projectDtoFor)
// so these nested mappers can stay sync while still emitting renderable urls.
type UrlOf = (key: string | null | undefined) => string | undefined;

// The minimal relation shape needed to derive the automatic project lifecycle.
// Lists, details and dashboards reuse this exact select so the status cannot
// differ between screens.
export const projectLifecycleSelect = {
  plannedDate: true,
  signedAt: true,
  listStatus: true,
  assignees: { select: { id: true } },
  invoice: { select: { status: true } },
  tasks: {
    select: {
      done: true,
      startedAt: true,
      endedAt: true,
      hours: true,
    },
  },
} as const;

// DTO mappers — never return raw rows with internal columns to clients.
//
// CRITICAL: technicians must not see prices/financials. `canSeePrices(role)` is
// false for technician; in that case every money field (line-item unitPrice, quote
// amount, project value, invoice amounts, extraWork price/amount) is stripped.

// Shape of a project loaded with all nested relations we expose.
export type ProjectWithRelations = Project & {
  workType: { id: string; name: string } | null;
  intake: Intake | null;
  handover: (Handover & { checklist: HandoverItem[] }) | null;
  deliveryChecklist:
    | (DeliveryChecklist & { items: DeliveryChecklistItem[] })
    | null;
  materialRequirements: MaterialRequirement[];
  tasks: ProjectTask[];
  installers: { id: string }[];
  workOrders?: (ProjectLifecycleWorkOrder & {
    id: string;
    ordinal: number;
    title: string;
    urgency: string;
    value: number;
  })[];
  activity?: (ProjectActivity & { user?: { name: string } | null })[];
  attachments?: ProjectAttachment[];
  contacts?: { id: string; name: string; email: string | null; phone: string | null; role: string | null }[];
};

// One project-level file, url resolved via the prebuilt lookup. Same shape as
// the werkbon attachment DTO, so the client panel renders both.
export function projectAttachmentDto(a: ProjectAttachment, urlOf: UrlOf) {
  return {
    id: a.id,
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
    url: urlOf(a.key) ?? "",
    createdAt: a.createdAt.toISOString(),
  };
}

function intakeDto(i: Intake) {
  return {
    id: i.id,
    status: i.status,
    plannedDate: i.plannedDate ?? undefined,
    contactName: i.contactName,
    contactEmail: i.contactEmail,
    contactPhone: i.contactPhone,
    address: i.address,
    insulationType: i.insulationType,
    squareMeters: i.squareMeters,
    cavityWidthMm: i.cavityWidthMm ?? undefined,
    existingInsulation: i.existingInsulation ?? undefined,
    buildingType: i.buildingType ?? undefined,
    accessibility: i.accessibility ?? undefined,
    photos: i.photos,
    notes: i.notes,
    risks: i.risks,
    estimatedMaterials: i.estimatedMaterials,
    estimatedLaborHours: i.estimatedLaborHours,
  };
}

function materialRequirementDto(r: MaterialRequirement) {
  return {
    id: r.id,
    materialId: r.materialId,
    materialName: r.materialName,
    quantityNeeded: r.quantityNeeded,
    quantityInStock: r.quantityInStock,
    unit: r.unit,
    supplier: r.supplier,
    expectedDeliveryDate: r.expectedDeliveryDate ?? undefined,
  };
}

function handoverDto(o: Handover & { checklist: HandoverItem[] }, urlOf: UrlOf) {
  return {
    id: o.id,
    photos: refsFrom(o.photos, urlOf),
    restpunten: o.restpunten,
    signedBy: o.signedBy ?? undefined,
    completedAt: o.completedAt ?? undefined,
    checklist: [...o.checklist]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((c) => ({ id: c.id, labelKey: c.labelKey, done: c.done })),
  };
}

function deliveryChecklistDto(
  d: DeliveryChecklist & { items: DeliveryChecklistItem[] },
) {
  return {
    id: d.id,
    qualityNotes: d.qualityNotes ?? undefined,
    items: [...d.items]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((i) => ({ id: i.id, labelKey: i.labelKey, complete: i.complete })),
  };
}

function taskDto(t: ProjectTask) {
  return { id: t.id, label: t.label, done: t.done, source: t.source };
}

export function activityDto(
  a: ProjectActivity & { user?: { name: string } | null },
) {
  return {
    id: a.id,
    projectId: a.projectId,
    userId: a.userId ?? undefined,
    userName: a.user?.name ?? undefined,
    type: a.type,
    // System/status/scheduled events carry a messageKey + params (i18n on the
    // client). Comments carry free text in `body`.
    messageKey: a.messageKey ?? undefined,
    params: (a.params as Record<string, unknown> | null) ?? undefined,
    body: a.body ?? undefined,
    fromStatus: a.fromStatus ?? undefined,
    toStatus: a.toStatus ?? undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

// Urgency is PER WERKBON; a project reads "urgent" only as a rollup — any of
// its unfinished werkbonnen urgent → "urgent". Display/KPI convenience, not a
// stored field. Blocked is a separate axis entirely (blocker/blockerKey).
function rollupUrgency(
  workOrders?: { urgency: string; signedAt: Date | string | null }[],
): "normal" | "urgent" {
  return (workOrders ?? []).some((w) => w.urgency === "urgent" && !w.signedAt)
    ? "urgent"
    : "normal";
}

// Lightweight list/summary DTO. `value` omitted for technicians when the org
// hides prices from them.
export function projectSummaryDto(
  p: Project & {
    _count?: { workOrders: number };
    workOrders?: (ProjectLifecycleWorkOrder & {
      value: number;
      urgency: string;
    })[];
  },
  role: UserRole,
) {
  const showPrices = canSeePrices(role);
  // Billing is per-werkbon: a project's value is the SUM of its werkbonnen's
  // values, derived on read (no stale denormalized column).
  const value = (p.workOrders ?? []).reduce((sum, w) => sum + w.value, 0);
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    // The CLIENT's own reference (their order/PO number) — distinct from
    // projectNumber, which is Opero's internal identity. Shown in the list so
    // a job can be found by the number the client quotes on the phone.
    referenceNumber: p.referenceNumber ?? undefined,
    name: p.name ?? undefined,
    customerId: p.customerId,
    customerName: p.customerName,
    city: p.city,
    status: p.status,
    lifecycleStatus: deriveProjectLifecycleStatus({
      archived: p.archived,
      workOrders: p.workOrders ?? [],
    }),
    stage: p.stage,
    archived: p.archived,
    urgency: rollupUrgency(p.workOrders),
    blocked: !!(p.blocker || p.blockerKey),
    nextStepKey: p.nextStepKey,
    // How many werkbonnen this project groups (the projects list needs this).
    workOrderCount: p._count?.workOrders ?? 0,
    canArchive: (p.workOrders ?? []).every((workOrder) => workOrder.signedAt !== null),
    ...(showPrices ? { value } : {}),
  };
}

// Full nested aggregate DTO. Takes the requesting role + the org's hide-prices
// flag so prices are stripped for technicians when the org enables it.
export function projectDto(
  p: ProjectWithRelations,
  role: UserRole,
  urlOf: UrlOf,
) {
  const showPrices = canSeePrices(role);
  // Project value = sum of its werkbonnen's values (per-werkbon billing).
  const value = (p.workOrders ?? []).reduce((sum, w) => sum + w.value, 0);
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    // The CLIENT's own reference (their order/PO number), never Opero's.
    referenceNumber: p.referenceNumber ?? undefined,
    name: p.name ?? undefined,
    customerId: p.customerId,
    customerName: p.customerName,
    locationId: p.locationId ?? undefined,
    address: p.address,
    postalCode: p.postalCode,
    city: p.city,
    contactName: p.contactName ?? undefined,
    contactPhone: p.contactPhone ?? undefined,
    // The project's contact persons (from the customer's central list).
    contacts: (p.contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      role: c.role ?? undefined,
    })),
    instructions: p.instructions ?? undefined,
    workTypeId: p.workTypeId ?? undefined,
    workTypeName: p.workType?.name ?? undefined,
    insulationType: p.insulationType,
    squareMeters: p.squareMeters,
    description: p.description ?? undefined,
    workTypes: p.workTypes,
    exclusions: p.exclusions ?? undefined,
    billingType: p.billingType ?? undefined,
    archived: p.archived,
    stage: p.stage,
    status: p.status,
    lifecycleStatus: deriveProjectLifecycleStatus({
      archived: p.archived,
      workOrders: p.workOrders ?? [],
    }),
    urgency: rollupUrgency(p.workOrders),
    blocked: !!(p.blocker || p.blockerKey),
    blocker: p.blocker ?? undefined,
    blockerKey: p.blockerKey ?? undefined,
    nextStepKey: p.nextStepKey,
    materialsReady: p.materialsReady,
    ...(showPrices ? { value } : {}),
    surveyPhotos: refsFrom(p.surveyPhotos, urlOf),
    surveyNotes: p.surveyNotes,
    // team ids
    projectLeaderId: p.projectLeaderId ?? undefined,
    teamLeaderId: p.teamLeaderId ?? undefined,
    installerIds: p.installers.map((i) => i.id),
    // nested (quote/invoice/extraWork are per-werkbon, on the work-order DTO)
    intake: p.intake ? intakeDto(p.intake) : undefined,
    handover: p.handover ? handoverDto(p.handover, urlOf) : undefined,
    deliveryChecklist: p.deliveryChecklist
      ? deliveryChecklistDto(p.deliveryChecklist)
      : undefined,
    materialRequirements: p.materialRequirements.map(materialRequirementDto),
    // The werkbonnen this project groups (summary rows for the detail screen).
    workOrders: (p.workOrders ?? []).map((w) => ({
      id: w.id,
      ordinal: w.ordinal,
      title: w.title,
      status: w.listStatus,
      plannedDate: w.plannedDate ?? undefined,
      signed: w.signedAt != null,
      ...(showPrices ? { value: w.value } : {}),
    })),
    tasks: [...p.tasks]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(taskDto),
    activity: (p.activity ?? []).map(activityDto),
    attachments: (p.attachments ?? []).map((a) => projectAttachmentDto(a, urlOf)),
  };
}

// Prisma include used by GET /:id to load the full aggregate.
//
// NOTE the nested `workOrders` list is UNSCOPED. That is correct only for
// office-level callers (every mutation route below is office-gated). Any route
// a technician can reach must use projectIncludeFor(user) instead, or the
// project detail screen hands them a list of their colleagues' werkbonnen.
export const projectInclude = {
  workType: { select: { id: true, name: true } },
  intake: true,
  // quote / invoice / extraWork are per-WERKBON now — carried by the work-order
  // DTO, not the project. The project is a grouping of werkbonnen.
  handover: { include: { checklist: true } },
  deliveryChecklist: { include: { items: true } },
  materialRequirements: true,
  tasks: true,
  installers: { select: { id: true } },
  // The project's werkbonnen (the visits it groups) — summary only, for the
  // project detail screen's werkbon list.
  workOrders: {
    orderBy: { ordinal: "asc" as const },
    select: {
      id: true,
      ordinal: true,
      title: true,
      urgency: true,
      value: true,
      ...projectLifecycleSelect,
    },
  },
  activity: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { user: { select: { name: true } } },
  },
  attachments: { orderBy: { createdAt: "asc" as const } },
  contacts: {
    orderBy: { name: "asc" as const },
    select: { id: true, name: true, email: true, phone: true, role: true },
  },
} as const;

// The same aggregate, with the nested werkbon list scoped to what THIS user may
// see. Werkbon visibility is per-assignment, so a technician on a project's crew
// must still only see the werkbonnen assigned to them — the project is just the
// grouping. For office/foreman the scope is `{}`, making this identical to
// projectInclude.
export function projectIncludeFor(user: AuthUser) {
  return {
    ...projectInclude,
    workOrders: { ...projectInclude.workOrders, where: visibleWorkOrdersWhere(user) },
  } as const;
}
