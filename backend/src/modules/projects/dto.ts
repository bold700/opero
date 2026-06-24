import type {
  DeliveryChecklist,
  DeliveryChecklistItem,
  Intake,
  Invoice,
  Meerwerk,
  MaterialRequirement,
  Oplevering,
  OpleverItem,
  Project,
  ProjectActivity,
  ProjectTask,
  Quote,
  QuoteLineItem,
} from "@prisma/client";
import { canSeePrices, type UserRole } from "@opero/shared";

// DTO mappers — never return raw rows with internal columns to clients.
//
// CRITICAL: monteurs must not see prices/financials. `canSeePrices(role)` is
// false for monteur; in that case every money field (line-item unitPrice, quote
// amount, project value, invoice amounts, meerwerk price/amount) is stripped.

// Shape of a project loaded with all nested relations we expose.
export type ProjectWithRelations = Project & {
  intake: Intake | null;
  quote: (Quote & { lineItems: QuoteLineItem[] }) | null;
  invoice: Invoice | null;
  oplevering: (Oplevering & { checklist: OpleverItem[] }) | null;
  deliveryChecklist:
    | (DeliveryChecklist & { items: DeliveryChecklistItem[] })
    | null;
  meerwerk: Meerwerk[];
  materialRequirements: MaterialRequirement[];
  tasks: ProjectTask[];
  installers: { id: string }[];
  activity?: (ProjectActivity & { user?: { name: string } | null })[];
};

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

function quoteLineDto(l: QuoteLineItem, showPrices: boolean) {
  return {
    id: l.id,
    catalogItemId: l.catalogItemId ?? undefined,
    werksoort: l.werksoort ?? undefined,
    description: l.description,
    size: l.size ?? undefined,
    quantity: l.quantity,
    unit: l.unit,
    ...(showPrices ? { unitPrice: l.unitPrice } : {}),
    ordinal: l.ordinal,
  };
}

function quoteDto(
  q: Quote & { lineItems: QuoteLineItem[] },
  showPrices: boolean,
) {
  return {
    id: q.id,
    status: q.status,
    ...(showPrices ? { amount: q.amount } : {}),
    sentDate: q.sentDate ?? undefined,
    acceptedDate: q.acceptedDate ?? undefined,
    lineItems: [...q.lineItems]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((l) => quoteLineDto(l, showPrices)),
  };
}

function invoiceDto(inv: Invoice, showPrices: boolean) {
  return {
    id: inv.id,
    status: inv.status,
    sentDate: inv.sentDate ?? undefined,
    paidDate: inv.paidDate ?? undefined,
    ...(showPrices
      ? {
          acceptedQuoteAmount: inv.acceptedQuoteAmount,
          extraWorkAmount: inv.extraWorkAmount,
          materialsAmount: inv.materialsAmount,
          laborAmount: inv.laborAmount,
        }
      : {}),
  };
}

function meerwerkDto(m: Meerwerk, showPrices: boolean) {
  return {
    id: m.id,
    description: m.description,
    label: m.label ?? undefined,
    name: m.name ?? undefined,
    quantity: m.quantity ?? undefined,
    unit: m.unit ?? undefined,
    diameter: m.diameter ?? undefined,
    ...(showPrices ? { unitPrice: m.unitPrice ?? undefined, amount: m.amount } : {}),
    photos: m.photos,
    createdAt: m.createdAt,
    done: m.done,
    approvedByOffice: m.approvedByOffice,
    approvedByClient: m.approvedByClient,
    rejected: m.rejected,
    rejectedBy: m.rejectedBy ?? undefined,
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

function opleveringDto(o: Oplevering & { checklist: OpleverItem[] }) {
  return {
    id: o.id,
    photos: o.photos,
    restpunten: o.restpunten,
    signedBy: o.signedBy ?? undefined,
    completedAt: o.completedAt ?? undefined,
    checklist: [...o.checklist]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((c) => ({ id: c.id, label: c.label, done: c.done })),
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
      .map((i) => ({ id: i.id, label: i.label, complete: i.complete })),
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
    body: a.body,
    fromStatus: a.fromStatus ?? undefined,
    toStatus: a.toStatus ?? undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

// Lightweight list/summary DTO. `value` omitted for monteurs.
export function projectSummaryDto(p: Project, role: UserRole) {
  const showPrices = canSeePrices(role);
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name ?? undefined,
    customerName: p.customerName,
    status: p.status,
    stage: p.stage,
    urgency: p.urgency,
    nextStep: p.nextStep,
    plannedDate: p.plannedDate ?? undefined,
    ...(showPrices ? { value: p.value } : {}),
  };
}

// Full nested aggregate DTO. Takes the requesting role so prices are stripped
// for monteurs.
export function projectDto(p: ProjectWithRelations, role: UserRole) {
  const showPrices = canSeePrices(role);
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name ?? undefined,
    customerId: p.customerId,
    customerName: p.customerName,
    locationId: p.locationId ?? undefined,
    address: p.address,
    postalCode: p.postalCode,
    city: p.city,
    contactName: p.contactName ?? undefined,
    contactPhone: p.contactPhone ?? undefined,
    instructions: p.instructions ?? undefined,
    insulationType: p.insulationType,
    squareMeters: p.squareMeters,
    description: p.description ?? undefined,
    werksoorten: p.werksoorten,
    exclusions: p.exclusions ?? undefined,
    billingType: p.billingType ?? undefined,
    archived: p.archived,
    stage: p.stage,
    status: p.status,
    urgency: p.urgency,
    blocker: p.blocker ?? undefined,
    nextStep: p.nextStep,
    materialsReady: p.materialsReady,
    plannedDate: p.plannedDate ?? undefined,
    plannedEndDate: p.plannedEndDate ?? undefined,
    ...(showPrices ? { value: p.value } : {}),
    opnamePhotos: p.opnamePhotos,
    opnameNotes: p.opnameNotes,
    // team ids
    projectLeaderId: p.projectLeaderId ?? undefined,
    teamLeaderId: p.teamLeaderId ?? undefined,
    installerIds: p.installers.map((i) => i.id),
    // nested
    intake: p.intake ? intakeDto(p.intake) : undefined,
    quote: p.quote ? quoteDto(p.quote, showPrices) : undefined,
    invoice: p.invoice ? invoiceDto(p.invoice, showPrices) : undefined,
    oplevering: p.oplevering ? opleveringDto(p.oplevering) : undefined,
    deliveryChecklist: p.deliveryChecklist
      ? deliveryChecklistDto(p.deliveryChecklist)
      : undefined,
    meerwerk: p.meerwerk.map((m) => meerwerkDto(m, showPrices)),
    materialRequirements: p.materialRequirements.map(materialRequirementDto),
    tasks: [...p.tasks]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(taskDto),
    activity: (p.activity ?? []).map(activityDto),
  };
}

// Prisma include used by GET /:id to load the full aggregate.
export const projectInclude = {
  intake: true,
  quote: { include: { lineItems: true } },
  invoice: true,
  oplevering: { include: { checklist: true } },
  deliveryChecklist: { include: { items: true } },
  meerwerk: true,
  materialRequirements: true,
  tasks: true,
  installers: { select: { id: true } },
  activity: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { user: { select: { name: true } } },
  },
} as const;
