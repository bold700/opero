export const projectStatusIds = [
  "verkoop",
  "operatie",
  "afronding",
] as const;

export type ProjectStatus = (typeof projectStatusIds)[number];

export const projectStatusLabels: Record<ProjectStatus, string> = {
  afronding: "Afronding",
  operatie: "Operatie",
  verkoop: "Verkoop",
};

// Rollen zijn gekoppeld aan projectfases en bijbehorende rechten (zie
// teamRoleConfig in roles.ts). Iemand kan meerdere rollen hebben.
export type Role =
  | "Sales"
  | "Werkvoorbereider"
  | "Planner"
  | "Voorman"
  | "Monteur"
  | "Administratie"
  | "Projectleider";

export type MaterialReadiness =
  | "available"
  | "partly_available"
  | "needs_ordering";

export type ProjectUrgency = "normal" | "urgent" | "blocked";

export type WorkOrderStatus =
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
  werksoort?: Werksoort;
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
export type TaakMateriaal = {
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

export type WerkbonTaak = {
  id: string;
  description: string;
  done: boolean;
  day?: string;
  materials: TaakMateriaal[];
  beforePhotos: string[];
  resultPhotos: string[];
  startedAt?: string;
  endedAt?: string;
  hours?: number;
  note?: string;
};

export type Werkbon = {
  id: string;
  title: string;
  drawings: string[];
  approvedByOpzichter: boolean;
  tasks: WerkbonTaak[];
};

export type Werksoort =
  | "Warme leidingisolatie"
  | "Koude isolatie"
  | "Akoestische isolatie"
  | "Brandwerende doorvoeringen";

// Vaste keuzelijst voor "Type project".
export const projectTypes: Werksoort[] = [
  "Warme leidingisolatie",
  "Koude isolatie",
  "Akoestische isolatie",
  "Brandwerende doorvoeringen",
];

export type ProjectTask = {
  id: string;
  label: string;
  done: boolean;
  source: "offerte" | "standaard";
};

// De regels staan in quote.lineItems (gedeeld over opname/calculatie/offerte).
// Opname houdt alleen foto's en condities bij.
export type Opname = {
  photos: string[];
  notes: string;
};

export type MeerwerkItem = {
  id: string;
  description: string;
  // Zelfde opbouw als een taakregel, zodat meerwerk identiek leest.
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

export type OpleverItem = {
  id: string;
  label: string;
  done: boolean;
};

export type Oplevering = {
  checklist: OpleverItem[];
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

export type WorkOrder = {
  id: string;
  projectId: string;
  date: string;
  assignedTeam: string;
  teamLeaderId: string;
  installerIds: string[];
  tasks: string[];
  checklist: {
    id: string;
    label: string;
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
  status: WorkOrderStatus;
};

export type DeliveryChecklist = {
  id: string;
  items: {
    id: string;
    label: string;
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
  werksoorten?: Werksoort[];
  exclusions?: string;
  billingType?: "vast" | "regie";
  werkbonnen?: Werkbon[];
  archived?: boolean;
  opname?: Opname;
  meerwerk?: MeerwerkItem[];
  oplevering?: Oplevering;
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
  nextStep: string;
  intake: Intake;
  quote: Quote;
  materialRequirements: MaterialRequirement[];
  planningItems: PlanningItem[];
  workOrders: WorkOrder[];
  deliveryChecklist: DeliveryChecklist;
  invoice: Invoice;
};
