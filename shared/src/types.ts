export const projectStatusIds = [
  "sales",
  "operations",
  "closing",
] as const;

export type ProjectStatus = (typeof projectStatusIds)[number];

export const projectStatusLabels: Record<ProjectStatus, string> = {
  closing: "Afronding",
  operations: "Operatie",
  sales: "Verkoop",
};

// Rollen zijn gekoppeld aan projectfases en bijbehorende rechten (zie
// teamRoleConfig in roles.ts). Iemand kan meerdere rollen hebben.
export type Role =
  | "Sales"
  | "WorkPlanner"
  | "Planner"
  | "Foreman"
  | "Technician"
  | "Administration"
  | "ProjectLeader";

export type MaterialReadiness =
  | "available"
  | "partly_available"
  | "needs_ordering";

export type ProjectUrgency = "normal" | "urgent" | "blocked";

// NOT the live work-order status. The running system stores
// `WorkOrder.listStatus` with a DIFFERENT value set — open | on_the_way |
// urgent | done — derived by deriveWorkOrderStatus() in
// backend/src/modules/work-orders/status.ts, and typed for the client in
// client/src/features/work-orders/api.ts. There is no "completed" at runtime;
// the finished bucket is "done".
//
// This type belongs to the mock-data fixtures below and nothing else. It is
// named MockWorkOrderStatus precisely so it can't be imported by mistake:
// reading "completed" here and going looking for it in the API was the reason
// work-order status appeared "not linked correctly" (WOB Isolatie, 17-07-2026).
export type MockWorkOrderStatus =
  | "planned"
  | "on_the_way"
  | "in_progress"
  | "blocked"
  | "completed";

export type QuoteStatus = "draft" | "sent" | "accepted";
export type InvoiceStatus = "not_started" | "draft" | "sent" | "paid";

export type Customer = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  notes?: string;
};

export type Intake = {
  id: string;
  status: "planned" | "completed";
  plannedDate?: string;
  customerDetails: {
    contactName: string;
    email: string;
    phone: string;
  };
  address: string;
  insulationType: string;
  squareMeters: number;
  cavityWidthMm?: number;
  existingInsulation?: boolean;
  buildingType?: string;
  accessibility?: string;
  photos: string[];
  notes: string;
  risks: string;
  estimatedMaterials: string[];
  estimatedLaborHours: number;
};

// Eén regel die door opname → calculatie → offerte groeit:
// opname legt werksoort/maat/aantal vast, calculatie zet er prijs op,
// offerte is de klantweergave ervan.
export type QuoteLineItem = {
  id: string;
  catalogItemId?: string;
  workType?: WorkType;
  description: string;
  size?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type Quote = {
  id: string;
  status: QuoteStatus;
  amount: number;
  sentDate?: string;
  acceptedDate?: string;
  lineItems: QuoteLineItem[];
};

export type Material = {
  id: string;
  name: string;
  unit: string;
};

export type InventoryItem = {
  id: string;
  materialId: string;
  materialName: string;
  quantityInStock: number;
  unit: string;
  supplier: string;
  reorderPoint: number;
};

export type MaterialRequirement = {
  id: string;
  materialId: string;
  materialName: string;
  quantityNeeded: number;
  quantityInStock: number;
  unit: string;
  supplier: string;
  expectedDeliveryDate?: string;
};

export type Stage = "concept" | "in_progress" | "ready" | "done";

// Eén gedeelde projectregel binnen een zone. Dezelfde regel voedt offerte,
// werkbon en factuur; elke rol ziet andere kolommen:
//  - offerte:  type, aantal, eenheid, Ø, prijs  (wat kun je offreren)
//  - werkbon:  type, aantal, eenheid, Ø, op locatie  (wat moet er gebeuren)
//  - factuur:  type, verbruik, eenheid, Ø, prijs  (wat is echt gebruikt)
export type TaskMaterial = {
  id: string;
  label?: string;
  name: string;
  quantity: number;
  usedQuantity?: number;
  unit: string;
  diameter?: number;
  unitPrice?: number;
  onSite: boolean;
  done?: boolean;
  note?: string;
};

export type WorkOrderTask = {
  id: string;
  description: string;
  done: boolean;
  day?: string;
  materials: TaskMaterial[];
  beforePhotos: string[];
  resultPhotos: string[];
  startedAt?: string;
  endedAt?: string;
  hours?: number;
  note?: string;
};

export type WorkOrder = {
  id: string;
  title: string;
  drawings: string[];
  approvedBySupervisor: boolean;
  tasks: WorkOrderTask[];
};

// WorkTypes zijn beheerbaar (zie store: workTypes), dus een vrije string.
export type WorkType = string;

// Standaardlijst waarmee de workTypes in de store geseed worden.
// Canonical, managed work types (the office-maintained list a project picks
// from). These are real insulation categories — not per-project descriptions.
// Display strings (NL); they're org content, not i18n keys.
export const projectTypes: WorkType[] = [
  "Spouwmuurisolatie",
  "Dakisolatie",
  "Vloerisolatie",
  "Kruipruimte-isolatie",
  "Bodemisolatie",
  "Gevelisolatie",
  "Plafondisolatie",
  "Binnenwandisolatie",
  "Warme leidingisolatie",
  "Koude isolatie",
  "Akoestische isolatie",
  "Brandwerende doorvoeringen",
];

// Canonical material categories — a FIXED set (closed enum). Internals are
// English keys; the UI translates them via i18n (materials.category.<key>).
// "other" is the catch-all default for materials with no explicit category.
export const materialCategories = [
  "insulation",
  "fastening",
  "foil",
  "sealing",
  "tools",
  "floor_insulation",
  "other",
] as const;
export type MaterialCategory = (typeof materialCategories)[number];

export type ProjectTask = {
  id: string;
  label: string;
  done: boolean;
  source: "offerte" | "standaard";
};

// De regels staan in quote.lineItems (gedeeld over opname/calculatie/offerte).
// Survey houdt alleen foto's en condities bij.
export type Survey = {
  photos: string[];
  notes: string;
};

export type ExtraWorkItem = {
  id: string;
  description: string;
  // Zelfde opbouw als een taakregel, zodat extraWork identiek leest.
  label?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  diameter?: number;
  unitPrice?: number;
  amount: number;
  photos: string[];
  createdAt: string;
  done?: boolean;
  approvedByOffice: boolean;
  approvedByClient: boolean;
  rejected: boolean;
  rejectedBy?: "office" | "client";
};

export type HandoverItem = {
  id: string;
  labelKey: string;
  done: boolean;
};

export type Handover = {
  checklist: HandoverItem[];
  photos: string[];
  restpunten: string;
  signedBy?: string;
  completedAt?: string;
};

export type PurchaseList = {
  id: string;
  projectId: string;
  createdAt: string;
  receivedAt?: string;
  items: {
    materialName: string;
    quantityToOrder: number;
    unit: string;
    supplier: string;
  }[];
};

export type TeamMember = {
  id: string;
  name: string;
  roles: Role[];
  phone: string;
  email?: string;
};

export type PlanningItem = {
  id: string;
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  projectLeaderId: string;
  teamLeaderId: string;
  installerIds: string[];
  vehicle: string;
};

export type WorkOrderExecution = {
  id: string;
  projectId: string;
  date: string;
  assignedTeam: string;
  teamLeaderId: string;
  installerIds: string[];
  tasks: string[];
  checklist: {
    id: string;
    labelKey: string;
    complete: boolean;
  }[];
  requiredMaterials: MaterialRequirement[];
  usedMaterials: {
    materialName: string;
    quantity: number;
    unit: string;
  }[];
  startTime?: string;
  endTime?: string;
  photos: string[];
  notes: string;
  customerSignature?: string;
  status: MockWorkOrderStatus;
};

export type DeliveryChecklist = {
  id: string;
  items: {
    id: string;
    labelKey: string;
    complete: boolean;
  }[];
  qualityNotes?: string;
};

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  acceptedQuoteAmount: number;
  extraWorkAmount: number;
  materialsAmount: number;
  laborAmount: number;
  sentDate?: string;
  paidDate?: string;
};

export type ProjectActivityType =
  | "status_change"
  | "comment"
  | "scheduled"
  | "system";

export type ProjectActivity = {
  id: string;
  projectId: string;
  profileId: string;
  type: ProjectActivityType;
  body: string;
  fromStatus?: ProjectStatus;
  toStatus?: ProjectStatus;
  createdAt: string;
};

export type Project = {
  id: string;
  projectNumber: string;
  name?: string;
  customerId: string;
  customerName: string;
  address: string;
  postalCode: string;
  city: string;
  contactName?: string;
  contactPhone?: string;
  instructions?: string;
  insulationType: string;
  squareMeters: number;
  description?: string;
  workTypes?: WorkType[];
  exclusions?: string;
  billingType?: "fixed" | "time_and_materials";
  workOrders?: WorkOrder[];
  archived?: boolean;
  survey?: Survey;
  extraWork?: ExtraWorkItem[];
  handover?: Handover;
  tasks?: ProjectTask[];
  stage?: Stage;
  signature?: string;
  materialsReady?: boolean;
  status: ProjectStatus;
  plannedDate?: string;
  plannedEndDate?: string;
  projectLeaderId: string;
  teamLeaderId: string;
  installerIds: string[];
  value: number;
  urgency: ProjectUrgency;
  blocker?: string;
  blockerKey?: string;
  nextStepKey: string;
  intake: Intake;
  quote: Quote;
  materialRequirements: MaterialRequirement[];
  planningItems: PlanningItem[];
  workOrderExecutions: WorkOrderExecution[];
  deliveryChecklist: DeliveryChecklist;
  invoice: Invoice;
};
