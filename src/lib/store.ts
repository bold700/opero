"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mockCustomers, mockInventory, mockProjects, mockTeamMembers } from "@/lib/mock-data";
import { testProfiles, type TestProfile } from "@/lib/roles";
import {
  canMoveToPlanned,
  getProjectMaterialReadiness,
  isDeliveryComplete,
} from "@/lib/workflow";
import {
  deriveInvoiceTotals,
  deriveMaterialRequirements,
  deriveQuoteLineItems,
  deriveWorkOrderChecklist,
  deriveWorkOrderTasks,
} from "@/lib/pricing";
import { catalogItems, findCatalogItem, type CatalogItem } from "@/lib/catalog";
import { STAGE_ORDER, getStage, statusForStage } from "@/lib/stages";
import {
  projectStatusLabels,
  type ProjectActivity,
  type ProjectActivityType,
  type ProjectStatus,
  type ProjectUrgency,
  type Customer,
  type Intake,
  type InventoryItem,
  type PlanningItem,
  type MeerwerkItem,
  type OpleverItem,
  type Project,
  type ProjectTask,
  type PurchaseList,
  type QuoteLineItem,
  type Role,
  type Stage,
  type TaakMateriaal,
  type Werkbon,
  type WerkbonTaak,
  type TeamMember,
  type WorkOrderStatus,
} from "@/lib/types";

export type CreateProjectInput = {
  customerId: string;
  name?: string;
  insulationType?: string;
  notes?: string;
};

export type CreateCustomerInput = Omit<Customer, "id">;

export type CreateTeamMemberInput = {
  name: string;
  phone: string;
  email?: string;
  roles?: Role[];
};

export type ProjectTeamPatch = {
  projectLeaderId?: string;
  teamLeaderId?: string;
  installerIds?: string[];
};

export type ProjectsViewMode = "board" | "table";

type OperoState = {
  activeProfileId: string;
  activity: ProjectActivity[];
  articles: CatalogItem[];
  customers: Customer[];
  inventory: InventoryItem[];
  profiles: TestProfile[];
  projects: Project[];
  projectsViewByProfile: Record<string, ProjectsViewMode>;
  purchaseLists: PurchaseList[];
  teamMembers: TeamMember[];
  addCustomer: (input: CreateCustomerInput) => Customer;
  updateCustomer: (
    id: string,
    patch: Partial<Omit<Customer, "id">>,
  ) => void;
  removeCustomer: (id: string) => void;
  addTeamMember: (input: CreateTeamMemberInput) => TeamMember;
  updateTeamMember: (
    id: string,
    patch: Partial<Pick<TeamMember, "name" | "phone" | "email" | "roles">>,
  ) => void;
  toggleTeamMemberRole: (id: string, role: Role) => void;
  removeTeamMember: (id: string) => void;
  setProjectTeam: (projectId: string, patch: ProjectTeamPatch) => void;
  setProjectUrgency: (projectId: string, urgency: ProjectUrgency) => void;
  setProjectsView: (profileId: string, view: ProjectsViewMode) => void;
  addProjectComment: (projectId: string, body: string) => void;
  acceptQuote: (projectId: string) => void;
  completeIntake: (
    projectId: string,
    data: {
      insulationType: string;
      squareMeters: number;
      cavityWidthMm?: number;
      existingInsulation?: boolean;
      buildingType?: string;
      accessibility?: string;
      estimatedLaborHours?: number;
      notes?: string;
      risks?: string;
      blocker?: string;
    },
  ) => void;
  resolveBlocker: (projectId: string, note?: string) => void;
  sendQuote: (projectId: string) => void;
  acceptQuoteOnly: (projectId: string) => void;
  completeWorkOrders: (projectId: string) => void;
  addQuoteLineItem: (projectId: string) => void;
  advanceProject: (projectId: string) => {
    advanced: boolean;
    message: string;
  };
  completeDelivery: (projectId: string) => void;
  createInvoiceDraft: (projectId: string) => void;
  createProject: (input: CreateProjectInput) => Project | undefined;
  deleteProject: (projectId: string) => void;
  createPurchaseList: (projectId: string) => PurchaseList | undefined;
  receivePurchaseList: (projectId: string, purchaseListId?: string) => boolean;
  markProjectPlanned: (projectId: string) => void;
  schedulePlanningSlot: (
    projectId: string,
    date: string,
    teamLeaderId: string,
  ) => void;
  scheduleProjectOnDay: (projectId: string, date: string) => void;
  setProjectDurationDays: (projectId: string, days: number) => void;
  unscheduleProject: (projectId: string) => void;
  toggleProjectInstaller: (projectId: string, memberId: string) => void;
  moveProjectToStatus: (
    projectId: string,
    status: ProjectStatus,
  ) => {
    moved: boolean;
    message: string;
  };
  moveToMaterialsCheck: (projectId: string) => void;
  addQuoteLineFromCatalog: (
    projectId: string,
    catalogItemId: string,
    quantity?: number,
  ) => void;
  removeQuoteLineItem: (projectId: string, lineItemId: string) => void;
  resetDemo: () => void;
  sendInvoice: (projectId: string) => void;
  setActiveProfile: (profileId: string) => void;
  markInvoicePaid: (projectId: string) => void;
  updateDeliveryItem: (projectId: string, itemId: string, complete: boolean) => void;
  updateIntake: (projectId: string, intake: Partial<Intake>) => void;
  updateProject: (
    projectId: string,
    patch: {
      name?: string;
      description?: string;
      plannedDate?: string;
      plannedEndDate?: string;
      materialsReady?: boolean;
      exclusions?: string;
      address?: string;
      postalCode?: string;
      city?: string;
      contactName?: string;
      contactPhone?: string;
      instructions?: string;
      insulationType?: string;
    },
  ) => void;
  advanceStage: (projectId: string) => void;
  setStage: (projectId: string, stage: Stage) => void;
  ensureWerkbon: (projectId: string) => void;
  createWerkbon: (projectId: string, title?: string) => void;
  removeWerkbon: (projectId: string, werkbonId: string) => void;
  approveWerkbon: (projectId: string, werkbonId: string) => void;
  addWerkbonDrawing: (projectId: string, werkbonId: string) => void;
  addWerkbonTask: (projectId: string, werkbonId: string) => void;
  removeWerkbonTask: (
    projectId: string,
    werkbonId: string,
    taskId: string,
  ) => void;
  reorderWerkbonTasks: (
    projectId: string,
    werkbonId: string,
    activeTaskId: string,
    overTaskId: string,
  ) => void;
  updateWerkbonTask: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    patch: Partial<Pick<WerkbonTaak, "description" | "day" | "done" | "note">>,
  ) => void;
  toggleWerkbonTask: (
    projectId: string,
    werkbonId: string,
    taskId: string,
  ) => void;
  startTask: (projectId: string, werkbonId: string, taskId: string) => void;
  endTask: (projectId: string, werkbonId: string, taskId: string) => void;
  setTaakHours: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    hours: number,
  ) => void;
  addTaakBeforePhoto: (
    projectId: string,
    werkbonId: string,
    taskId: string,
  ) => void;
  addTaakResultPhoto: (
    projectId: string,
    werkbonId: string,
    taskId: string,
  ) => void;
  removeTaakPhoto: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    photo: string,
  ) => void;
  addTaakMateriaal: (
    projectId: string,
    werkbonId: string,
    taskId: string,
  ) => void;
  addTaakRegel: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    input: {
      name: string;
      quantity: number;
      unit: string;
      unitPrice?: number;
      diameter?: number;
      label?: string;
    },
  ) => void;
  updateTaakMateriaal: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    materiaalId: string,
    patch: Partial<Omit<TaakMateriaal, "id">>,
  ) => void;
  removeTaakMateriaal: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    materiaalId: string,
  ) => void;
  archiveProject: (projectId: string) => void;
  addArticle: (input: Omit<CatalogItem, "id">) => void;
  updateArticle: (articleId: string, patch: Partial<Omit<CatalogItem, "id">>) => void;
  removeArticle: (articleId: string) => void;
  generateTasks: (projectId: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  addMeerwerk: (
    projectId: string,
    input: {
      name: string;
      quantity: number;
      unit: string;
      diameter?: number;
      unitPrice?: number;
      label?: string;
      photo?: boolean;
    },
  ) => void;
  approveMeerwerkOffice: (projectId: string, meerwerkId: string) => void;
  approveMeerwerkClient: (projectId: string, meerwerkId: string) => void;
  toggleMeerwerkDone: (projectId: string, meerwerkId: string) => void;
  rejectMeerwerk: (
    projectId: string,
    meerwerkId: string,
    by?: "office" | "client",
  ) => void;
  setMateriaalUsage: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    materiaalId: string,
    used: number,
  ) => void;
  toggleMateriaalDone: (
    projectId: string,
    werkbonId: string,
    taskId: string,
    materiaalId: string,
  ) => void;
  completeAllTaken: (projectId: string) => void;
  addOpnamePhoto: (projectId: string) => void;
  setOpnameNotes: (projectId: string, notes: string) => void;
  applyNormPrices: (projectId: string) => void;
  initOplevering: (projectId: string) => void;
  toggleOpleverItem: (projectId: string, itemId: string) => void;
  addOpleverPhoto: (projectId: string) => void;
  setRestpunten: (projectId: string, restpunten: string) => void;
  signOplevering: (projectId: string, signedBy: string) => void;
  updateQuoteLineItem: (
    projectId: string,
    lineItemId: string,
    patch: Partial<Omit<QuoteLineItem, "id">>,
  ) => void;
  updateWorkOrderStatus: (
    projectId: string,
    workOrderId: string,
    status: WorkOrderStatus,
  ) => void;
  addWorkOrderPhoto: (projectId: string, workOrderId: string) => void;
  addWorkOrderNote: (
    projectId: string,
    workOrderId: string,
    note: string,
  ) => void;
  addExtraWork: (
    projectId: string,
    description: string,
    amount: number,
  ) => void;
};

function recalcQuoteAmount(lineItems: QuoteLineItem[]) {
  return lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
    0,
  );
}

function formatEuro(value: number) {
  return `€ ${Math.round(value).toLocaleString("nl-NL")}`;
}

// Eenvoudige normprijs per eenheid (later: echte normendatabase).
function normPriceFor(unit: string) {
  if (unit === "m") return 22;
  if (unit === "m2") return 38;
  if (unit === "stuks" || unit === "stuk") return 45;
  return 30;
}

type ProjectsSet = (
  updater: (state: { projects: Project[] }) => { projects: Project[] },
) => void;

let photoSeq = 0;
function uniquePhotoName(prefix: string) {
  photoSeq += 1;
  return `${prefix}-${Date.now()}-${photoSeq}.jpg`;
}

let emptyWerkbonSeq = 0;
function emptyWerkbon(projectId: string): Werkbon {
  emptyWerkbonSeq += 1;
  const stamp = `${Date.now()}-${emptyWerkbonSeq}`;
  return {
    id: `wb-${projectId}-${stamp}`,
    title: "Werkbon 1",
    drawings: [],
    approvedByOpzichter: false,
    // Start leeg: een nieuw project toont de lege staat met "Taak aanmaken".
    tasks: [],
  };
}

// Offertebedrag = som van alle regels (aantal x prijs). Houdt project.value in
// sync met de gedeelde regelset.
function regelsOfferteBedrag(werkbonnen: Werkbon[] | undefined): number {
  return (werkbonnen ?? []).reduce(
    (sum, wb) =>
      sum +
      wb.tasks.reduce(
        (t, task) =>
          t +
          task.materials.reduce(
            (m, mat) => m + mat.quantity * (mat.unitPrice ?? 0),
            0,
          ),
        0,
      ),
    0,
  );
}

function patchWerkbon(
  set: ProjectsSet,
  projectId: string,
  werkbonId: string,
  fn: ((wb: Werkbon) => Werkbon) | null,
) {
  set((state) => ({
    projects: state.projects.map((project) => {
      if (project.id !== projectId) return project;
      const list = project.werkbonnen ?? [];
      const werkbonnen =
        fn === null
          ? list.filter((wb) => wb.id !== werkbonId)
          : list.map((wb) => (wb.id === werkbonId ? fn(wb) : wb));
      // Houd het offertebedrag synchroon met de regels.
      const value = regelsOfferteBedrag(werkbonnen) || project.value;
      return { ...project, werkbonnen, value };
    }),
  }));
}

function patchTask(
  set: ProjectsSet,
  projectId: string,
  werkbonId: string,
  taskId: string,
  fn: (task: WerkbonTaak) => WerkbonTaak,
) {
  patchWerkbon(set, projectId, werkbonId, (wb) => ({
    ...wb,
    tasks: wb.tasks.map((task) => (task.id === taskId ? fn(task) : task)),
  }));
}

type ActivitySet = (
  updater: (state: {
    activity: ProjectActivity[];
    activeProfileId: string;
  }) => { activity: ProjectActivity[] },
) => void;

// Legt één regel in het verloop van aanpassingen vast (offerte -> uitvoering ->
// factuur), zodat kantoor elke wijziging op de werkbon kan herleiden.
function logChange(set: ActivitySet, projectId: string, body: string) {
  set((state) => ({
    activity: [
      makeActivity(projectId, state.activeProfileId, "system", body),
      ...state.activity,
    ],
  }));
}

// Zoekt de taak op en geeft een leesbare context (taaknaam) voor het logboek.
function taskScope(
  get: () => { projects: Project[] },
  projectId: string,
  werkbonId: string,
  taskId: string,
): { task?: WerkbonTaak; scope: string } {
  const project = get().projects.find((p) => p.id === projectId);
  const werkbon = project?.werkbonnen?.find((w) => w.id === werkbonId);
  const task = werkbon?.tasks.find((t) => t.id === taskId);
  return { task, scope: task?.description?.trim() || werkbon?.title || "Werkbon" };
}

function deriveProjectFromQuote(project: Project): Partial<Project> {
  const lines = project.quote.lineItems;
  const isoLine = lines.find((line) => {
    const item = findCatalogItem(line.catalogItemId);
    return item?.category === "isolatie";
  });
  const laborLine = lines.find((line) => {
    const item = findCatalogItem(line.catalogItemId);
    return item?.category === "arbeid";
  });
  const materialNames = lines
    .filter((line) => {
      const item = findCatalogItem(line.catalogItemId);
      return item?.category === "materiaal";
    })
    .map((line) => line.description);
  const amount = recalcQuoteAmount(lines);
  return {
    insulationType: isoLine?.description ?? project.insulationType,
    squareMeters: isoLine?.quantity ?? project.squareMeters,
    value: amount,
    intake: {
      ...project.intake,
      estimatedLaborHours:
        laborLine?.quantity ?? project.intake.estimatedLaborHours,
      estimatedMaterials:
        materialNames.length > 0 ? materialNames : project.intake.estimatedMaterials,
      insulationType: isoLine?.description ?? project.intake.insulationType,
      squareMeters: isoLine?.quantity ?? project.intake.squareMeters,
    },
  };
}

function buildEmptyProject(
  input: CreateProjectInput,
  customer: Customer,
  projectNumber: string,
): Project {
  const id = `p-${Date.now()}`;
  const defaultInsulation = input.insulationType?.trim() || "Nog te bepalen";

  return {
    address: customer.address,
    blocker: undefined,
    city: customer.city,
    customerId: customer.id,
    customerName: customer.name,
    name: input.name?.trim() || undefined,
    deliveryChecklist: {
      id: `dc-${id}`,
      items: [
        { complete: false, id: `dc-${id}-1`, label: "Werk uitgevoerd volgens opdracht" },
        { complete: false, id: `dc-${id}-2`, label: "Fotos geupload" },
        { complete: false, id: `dc-${id}-3`, label: "Materialen geregistreerd" },
        { complete: false, id: `dc-${id}-4`, label: "Meerwerk akkoord" },
        { complete: false, id: `dc-${id}-5`, label: "Handtekening opdrachtgever" },
        { complete: false, id: `dc-${id}-6`, label: "Kwaliteitscheck afgerond" },
      ],
    },
    description: input.notes ?? "",
    stage: "concept",
    materialsReady: false,
    werksoorten: [],
    exclusions: "",
    werkbonnen: [emptyWerkbon(id)],
    archived: false,
    opname: { photos: [], notes: "" },
    meerwerk: [],
    id,
    installerIds: [],
    insulationType: defaultInsulation,
    intake: {
      address: `${customer.address}, ${customer.postalCode} ${customer.city}`,
      customerDetails: {
        contactName: customer.contactName,
        email: customer.email,
        phone: customer.phone,
      },
      estimatedLaborHours: 0,
      estimatedMaterials: [],
      id: `intake-${id}`,
      insulationType: defaultInsulation,
      notes: input.notes ?? "",
      photos: [],
      risks: "",
      squareMeters: 0,
      status: "planned",
    },
    invoice: {
      acceptedQuoteAmount: 0,
      extraWorkAmount: 0,
      id: `inv-${id}`,
      laborAmount: 0,
      materialsAmount: 0,
      status: "not_started",
    },
    materialRequirements: [],
    nextStep: "Intake inplannen",
    planningItems: [],
    postalCode: customer.postalCode,
    projectLeaderId: "",
    projectNumber,
    quote: {
      amount: 0,
      id: `q-${id}`,
      lineItems: [],
      status: "draft",
    },
    squareMeters: 0,
    status: "verkoop",
    teamLeaderId: "",
    urgency: "normal",
    value: 0,
    workOrders: [],
  };
}

function nextProjectNumber(projects: Project[]) {
  const year = new Date().getFullYear();
  const used = projects
    .map((project) => {
      const match = project.projectNumber.match(/OP-(\d{4})-(\d+)/);
      if (!match) return 0;
      const [, projectYear, num] = match;
      return projectYear === String(year) ? Number(num) : 0;
    })
    .reduce((max, num) => Math.max(max, num), 0);

  return `OP-${year}-${String(used + 1).padStart(3, "0")}`;
}

function cloneProjects() {
  return structuredClone(mockProjects);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const MAX_TEXT = 4000;
const MAX_NUMBER = 1_000_000;

function clampText(value: string | undefined | null): string {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_TEXT);
}

function clampNumber(value: number | undefined | null): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_NUMBER, n));
}

function makeActivity(
  projectId: string,
  profileId: string,
  type: ProjectActivityType,
  body: string,
  fromStatus?: ProjectStatus,
  toStatus?: ProjectStatus,
): ProjectActivity {
  return {
    body,
    createdAt: new Date().toISOString(),
    fromStatus,
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profileId,
    projectId,
    toStatus,
    type,
  };
}

const nextStepByManualStatus: Record<ProjectStatus, string> = {
  afronding: "Oplevering en factuur",
  operatie: "Werk uitvoeren",
  verkoop: "Offerte versturen",
};

export const useOperoStore = create<OperoState>()(
  persist(
    (set, get) => ({
      activeProfileId: "profile-super-admin",
      activity: [],
      articles: catalogItems,
      customers: mockCustomers,
      inventory: mockInventory,
      profiles: testProfiles,
      projects: [],
      projectsViewByProfile: {},
      purchaseLists: [],
      teamMembers: mockTeamMembers,

      setProjectsView: (profileId, view) => {
        set((state) => ({
          projectsViewByProfile: {
            ...state.projectsViewByProfile,
            [profileId]: view,
          },
        }));
      },

      addCustomer: (input) => {
        const customer: Customer = {
          address: clampText(input.address),
          city: clampText(input.city),
          contactName: clampText(input.contactName),
          email: clampText(input.email),
          id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: clampText(input.name),
          notes: input.notes ? clampText(input.notes) : undefined,
          phone: clampText(input.phone),
          postalCode: clampText(input.postalCode),
        };
        set((state) => ({ customers: [...state.customers, customer] }));
        return customer;
      },

      updateCustomer: (id, patch) => {
        set((state) => ({
          customers: state.customers.map((customer) =>
            customer.id === id
              ? {
                  ...customer,
                  ...patch,
                  name: patch.name !== undefined ? clampText(patch.name) : customer.name,
                  contactName:
                    patch.contactName !== undefined
                      ? clampText(patch.contactName)
                      : customer.contactName,
                  email:
                    patch.email !== undefined ? clampText(patch.email) : customer.email,
                  phone:
                    patch.phone !== undefined ? clampText(patch.phone) : customer.phone,
                  address:
                    patch.address !== undefined
                      ? clampText(patch.address)
                      : customer.address,
                  postalCode:
                    patch.postalCode !== undefined
                      ? clampText(patch.postalCode)
                      : customer.postalCode,
                  city: patch.city !== undefined ? clampText(patch.city) : customer.city,
                }
              : customer,
          ),
        }));
      },

      removeCustomer: (id) => {
        set((state) => ({
          customers: state.customers.filter((customer) => customer.id !== id),
        }));
      },

      addTeamMember: (input) => {
        const member: TeamMember = {
          id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: clampText(input.name),
          phone: clampText(input.phone),
          email: input.email ? clampText(input.email) : undefined,
          roles: input.roles ?? [],
        };
        set((state) => ({ teamMembers: [...state.teamMembers, member] }));
        return member;
      },

      updateTeamMember: (id, patch) => {
        set((state) => ({
          teamMembers: state.teamMembers.map((member) =>
            member.id === id
              ? {
                  ...member,
                  ...patch,
                  name: patch.name !== undefined ? clampText(patch.name) : member.name,
                  phone:
                    patch.phone !== undefined ? clampText(patch.phone) : member.phone,
                  email:
                    patch.email !== undefined
                      ? clampText(patch.email) || undefined
                      : member.email,
                }
              : member,
          ),
        }));
      },

      toggleTeamMemberRole: (id, role) => {
        set((state) => ({
          teamMembers: state.teamMembers.map((member) =>
            member.id === id
              ? {
                  ...member,
                  roles: member.roles.includes(role)
                    ? member.roles.filter((r) => r !== role)
                    : [...member.roles, role],
                }
              : member,
          ),
        }));
      },

      removeTeamMember: (id) => {
        set((state) => ({
          teamMembers: state.teamMembers.filter((member) => member.id !== id),
        }));
      },

      setProjectUrgency: (projectId, urgency) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, urgency } : project,
          ),
        }));
      },

      setProjectTeam: (projectId, patch) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            return {
              ...project,
              installerIds: patch.installerIds ?? project.installerIds,
              projectLeaderId: patch.projectLeaderId ?? project.projectLeaderId,
              teamLeaderId: patch.teamLeaderId ?? project.teamLeaderId,
            };
          }),
        }));
      },

      updateProject: (projectId, patch) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            // Start, eind en aantal dagen rekenen met elkaar door. Start en
            // eind zijn de grenzen; het aantal dagen leidt het systeem hieruit
            // af (zie planDurationDays). Eind kan nooit voor start liggen.
            let plannedDate = project.plannedDate;
            let plannedEndDate = project.plannedEndDate;
            if (patch.plannedDate !== undefined) {
              const nextStart = patch.plannedDate || undefined;
              plannedDate = nextStart;
              if (!nextStart) {
                plannedEndDate = undefined;
              } else if (plannedEndDate && plannedEndDate < nextStart) {
                // Eind viel voor de nieuwe start: terug naar één dag.
                plannedEndDate = undefined;
              }
            }
            if (patch.plannedEndDate !== undefined) {
              const end = patch.plannedEndDate || undefined;
              plannedEndDate =
                end && plannedDate && end < plannedDate ? plannedDate : end;
            }
            return {
              ...project,
              name:
                patch.name !== undefined
                  ? clampText(patch.name).trim() || undefined
                  : project.name,
              description:
                patch.description !== undefined
                  ? clampText(patch.description)
                  : project.description,
              plannedDate,
              plannedEndDate,
              materialsReady:
                patch.materialsReady !== undefined
                  ? patch.materialsReady
                  : project.materialsReady,
              exclusions:
                patch.exclusions !== undefined
                  ? clampText(patch.exclusions)
                  : project.exclusions,
              address:
                patch.address !== undefined
                  ? clampText(patch.address)
                  : project.address,
              postalCode:
                patch.postalCode !== undefined
                  ? clampText(patch.postalCode)
                  : project.postalCode,
              city:
                patch.city !== undefined ? clampText(patch.city) : project.city,
              contactName:
                patch.contactName !== undefined
                  ? clampText(patch.contactName).trim() || undefined
                  : project.contactName,
              contactPhone:
                patch.contactPhone !== undefined
                  ? clampText(patch.contactPhone).trim() || undefined
                  : project.contactPhone,
              instructions:
                patch.instructions !== undefined
                  ? clampText(patch.instructions).trim() || undefined
                  : project.instructions,
              insulationType:
                patch.insulationType !== undefined
                  ? clampText(patch.insulationType)
                  : project.insulationType,
            };
          }),
        }));
      },

      advanceStage: (projectId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return;
        const idx = STAGE_ORDER.indexOf(getStage(project));
        get().setStage(
          projectId,
          STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)],
        );
      },

      setStage: (projectId, stage) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const next: Project = {
              ...project,
              stage,
              status: statusForStage(stage),
            };
            // Bij "done" een conceptfactuur klaarzetten als die er nog niet is.
            if (stage === "done" && project.invoice.status === "not_started") {
              return {
                ...next,
                invoice: {
                  ...project.invoice,
                  ...deriveInvoiceTotals(project),
                  status: "draft",
                },
              };
            }
            return next;
          }),
        }));
        if (stage === "in_progress") get().ensureWerkbon(projectId);
      },

      ensureWerkbon: (projectId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project || (project.werkbonnen ?? []).length > 0) return;
        // Eén gedeelde regelset per project: maak een lege werkbon met één zone.
        // Offerte vult de regels (met prijs), werkbon verfijnt ze, factuur leest
        // het werkelijk verbruik.
        set((state) => ({
          projects: state.projects.map((item) =>
            item.id === projectId
              ? { ...item, werkbonnen: [emptyWerkbon(projectId)] }
              : item,
          ),
        }));
      },

      createWerkbon: (projectId, title) => {
        set((state) => ({
          projects: state.projects.map((item) => {
            if (item.id !== projectId) return item;
            const list = item.werkbonnen ?? [];
            const werkbon: Werkbon = {
              id: `wb-${projectId}-${Date.now()}`,
              title: title?.trim() || `Werkbon ${list.length + 1}`,
              drawings: [],
              approvedByOpzichter: false,
              tasks: [],
            };
            return { ...item, werkbonnen: [...list, werkbon] };
          }),
        }));
      },

      removeWerkbon: (projectId, werkbonId) =>
        patchWerkbon(set, projectId, werkbonId, null),

      approveWerkbon: (projectId, werkbonId) =>
        patchWerkbon(set, projectId, werkbonId, (wb) => ({
          ...wb,
          approvedByOpzichter: !wb.approvedByOpzichter,
        })),

      addWerkbonDrawing: (projectId, werkbonId) =>
        patchWerkbon(set, projectId, werkbonId, (wb) => ({
          ...wb,
          drawings: [...wb.drawings, `tekening-${Date.now()}.pdf`],
        })),

      addWerkbonTask: (projectId, werkbonId) => {
        patchWerkbon(set, projectId, werkbonId, (wb) => ({
          ...wb,
          tasks: [
            ...wb.tasks,
            {
              id: `wt-${werkbonId}-${Date.now()}`,
              description: "",
              done: false,
              materials: [],
              beforePhotos: [],
              resultPhotos: [],
            },
          ],
        }));
        logChange(set, projectId, "Zone toegevoegd");
      },

      removeWerkbonTask: (projectId, werkbonId, taskId) => {
        const { scope } = taskScope(get, projectId, werkbonId, taskId);
        patchWerkbon(set, projectId, werkbonId, (wb) => ({
          ...wb,
          tasks: wb.tasks.filter((task) => task.id !== taskId),
        }));
        logChange(set, projectId, `Zone verwijderd: ${scope}`);
      },

      reorderWerkbonTasks: (projectId, werkbonId, activeTaskId, overTaskId) => {
        patchWerkbon(set, projectId, werkbonId, (wb) => {
          const from = wb.tasks.findIndex((t) => t.id === activeTaskId);
          const to = wb.tasks.findIndex((t) => t.id === overTaskId);
          if (from < 0 || to < 0 || from === to) return wb;
          const tasks = [...wb.tasks];
          const [moved] = tasks.splice(from, 1);
          tasks.splice(to, 0, moved);
          return { ...wb, tasks };
        });
        logChange(set, projectId, "Zones opnieuw geordend");
      },

      updateWerkbonTask: (projectId, werkbonId, taskId, patch) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        patchTask(set, projectId, werkbonId, taskId, (current) => ({
          ...current,
          ...patch,
          description:
            patch.description !== undefined
              ? clampText(patch.description)
              : current.description,
          note: patch.note !== undefined ? clampText(patch.note) : current.note,
        }));
        if (!task) return;
        if (
          patch.description !== undefined &&
          clampText(patch.description) !== task.description
        ) {
          logChange(
            set,
            projectId,
            `Taak: "${task.description || "leeg"}" gewijzigd naar "${
              clampText(patch.description) || "leeg"
            }"`,
          );
        }
        if (patch.note !== undefined && clampText(patch.note) !== (task.note ?? "")) {
          const next = clampText(patch.note);
          logChange(
            set,
            projectId,
            next
              ? `Opmerking bij ${scope}: "${next}"`
              : `Opmerking bij ${scope} verwijderd`,
          );
        }
      },

      toggleWerkbonTask: (projectId, werkbonId, taskId) =>
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          done: !task.done,
        })),

      startTask: (projectId, werkbonId, taskId) =>
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          startedAt: task.startedAt ?? new Date().toISOString(),
        })),

      endTask: (projectId, werkbonId, taskId) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        patchTask(set, projectId, werkbonId, taskId, (current) => {
          const endedAt = new Date().toISOString();
          // Timer is de automatische route: reken de gewerkte uren uit en vul
          // ze in. De monteur kan ze daarna nog handmatig bijstellen.
          let hours = current.hours;
          if (current.startedAt) {
            const ms = Date.parse(endedAt) - Date.parse(current.startedAt);
            if (ms > 0) hours = Math.round((ms / 3_600_000) * 4) / 4;
          }
          return { ...current, endedAt, done: true, hours };
        });
        if (task?.startedAt) {
          const ms = Date.now() - Date.parse(task.startedAt);
          const hours = ms > 0 ? Math.round((ms / 3_600_000) * 4) / 4 : 0;
          logChange(set, projectId, `${scope} afgerond, ${hours} u via timer`);
        }
      },

      setTaakHours: (projectId, werkbonId, taskId, hours) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        patchTask(set, projectId, werkbonId, taskId, (current) => ({
          ...current,
          hours: hours > 0 ? hours : undefined,
        }));
        if (task && (task.hours ?? 0) !== hours) {
          logChange(
            set,
            projectId,
            `Uren ${scope}: ${task.hours ?? 0} naar ${hours > 0 ? hours : 0} u`,
          );
        }
      },

      addTaakBeforePhoto: (projectId, werkbonId, taskId) =>
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          beforePhotos: [...task.beforePhotos, uniquePhotoName("begin")],
        })),

      addTaakResultPhoto: (projectId, werkbonId, taskId) =>
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          resultPhotos: [...task.resultPhotos, uniquePhotoName("resultaat")],
        })),

      removeTaakPhoto: (projectId, werkbonId, taskId, photo) =>
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          beforePhotos: task.beforePhotos.filter((p) => p !== photo),
          resultPhotos: task.resultPhotos.filter((p) => p !== photo),
        })),

      addTaakMateriaal: (projectId, werkbonId, taskId) => {
        const { scope } = taskScope(get, projectId, werkbonId, taskId);
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          materials: [
            ...task.materials,
            {
              id: `mat-${taskId}-${Date.now()}`,
              name: "",
              quantity: 1,
              unit: "meter",
              onSite: false,
            },
          ],
        }));
        logChange(set, projectId, `Product toegevoegd bij ${scope}`);
      },

      addTaakRegel: (projectId, werkbonId, taskId, input) => {
        const { scope } = taskScope(get, projectId, werkbonId, taskId);
        patchTask(set, projectId, werkbonId, taskId, (task) => ({
          ...task,
          materials: [
            ...task.materials,
            {
              id: `mat-${taskId}-${Date.now()}`,
              name: clampText(input.name),
              quantity: clampNumber(input.quantity),
              unit: input.unit,
              unitPrice: input.unitPrice,
              diameter: input.diameter,
              label: input.label ? clampText(input.label) : undefined,
              onSite: false,
            },
          ],
        }));
        logChange(
          set,
          projectId,
          `Taak toegevoegd bij ${scope}: ${input.name}`,
        );
      },

      updateTaakMateriaal: (projectId, werkbonId, taskId, materiaalId, patch) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        const before = task?.materials.find((m) => m.id === materiaalId);
        patchTask(set, projectId, werkbonId, taskId, (current) => ({
          ...current,
          materials: current.materials.map((m) =>
            m.id === materiaalId
              ? {
                  ...m,
                  ...patch,
                  name: patch.name !== undefined ? clampText(patch.name) : m.name,
                }
              : m,
          ),
        }));
        if (!before) return;
        if (patch.name !== undefined && clampText(patch.name) !== before.name) {
          logChange(
            set,
            projectId,
            `Product bij ${scope}: "${before.name || "leeg"}" gewijzigd naar "${
              clampText(patch.name) || "leeg"
            }"`,
          );
        }
        if (patch.quantity !== undefined && patch.quantity !== before.quantity) {
          logChange(
            set,
            projectId,
            `${before.name || "Product"}: gepland aantal ${before.quantity} naar ${
              patch.quantity
            } ${before.unit}`,
          );
        }
        if (patch.note !== undefined && clampText(patch.note) !== (before.note ?? "")) {
          const next = clampText(patch.note);
          logChange(
            set,
            projectId,
            next
              ? `Opmerking bij ${before.name || "product"}: "${next}"`
              : `Opmerking bij ${before.name || "product"} verwijderd`,
          );
        }
      },

      removeTaakMateriaal: (projectId, werkbonId, taskId, materiaalId) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        const before = task?.materials.find((m) => m.id === materiaalId);
        patchTask(set, projectId, werkbonId, taskId, (current) => ({
          ...current,
          materials: current.materials.filter((m) => m.id !== materiaalId),
        }));
        if (before) {
          logChange(
            set,
            projectId,
            `Product verwijderd bij ${scope}: ${before.name || "product"}`,
          );
        }
      },

      archiveProject: (projectId) => {
        set((state) => ({
          projects: state.projects.map((item) =>
            item.id === projectId
              ? { ...item, archived: true, stage: "done", status: "afronding" }
              : item,
          ),
        }));
      },

      addArticle: (input) => {
        set((state) => ({
          articles: [
            ...state.articles,
            { ...input, id: `art-${Date.now()}`, name: clampText(input.name) },
          ],
        }));
      },

      updateArticle: (articleId, patch) => {
        set((state) => ({
          articles: state.articles.map((article) =>
            article.id === articleId
              ? {
                  ...article,
                  ...patch,
                  name:
                    patch.name !== undefined ? clampText(patch.name) : article.name,
                }
              : article,
          ),
        }));
      },

      removeArticle: (articleId) => {
        set((state) => ({
          articles: state.articles.filter((article) => article.id !== articleId),
        }));
      },

      generateTasks: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            if (project.tasks && project.tasks.length > 0) return project;
            const lineTasks: ProjectTask[] = project.quote.lineItems.map(
              (line, i) => ({
                id: `task-${project.id}-line-${i}`,
                label: `Uitvoeren: ${line.description}${line.quantity > 1 ? ` (${line.quantity}×)` : ""}`,
                done: false,
                source: "offerte",
              }),
            );
            const std = (label: string, key: string): ProjectTask => ({
              id: `task-${project.id}-${key}`,
              label,
              done: false,
              source: "standaard",
            });
            const tasks: ProjectTask[] = [
              std("Bus inladen en materiaal controleren", "inladen"),
              std("Werkplek inrichten en veilig afzetten", "afzetten"),
              ...lineTasks,
              std("Verbruik en foto's registreren", "registreren"),
              std("Opruimen en afval afvoeren", "opruimen"),
              std("Oplevering met de klant", "oplevering"),
            ];
            return { ...project, tasks };
          }),
        }));
      },

      toggleTask: (projectId, taskId) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  tasks: (project.tasks ?? []).map((task) =>
                    task.id === taskId ? { ...task, done: !task.done } : task,
                  ),
                }
              : project,
          ),
        }));
      },

      addMeerwerk: (projectId, input) => {
        const name = clampText(input.name).trim();
        if (!name) return;
        const quantity = clampNumber(input.quantity);
        const unit = clampText(input.unit).trim();
        const unitPrice = input.unitPrice ? clampNumber(input.unitPrice) : 0;
        const label = input.label ? clampText(input.label).trim() : undefined;
        const description = label || `${quantity} ${unit} ${name}`.trim();
        const item: MeerwerkItem = {
          id: `mw-${projectId}-${Date.now()}`,
          description,
          label,
          name,
          quantity,
          unit,
          diameter: input.diameter ? clampNumber(input.diameter) : undefined,
          unitPrice,
          amount: quantity * unitPrice,
          photos: input.photo ? [`meerwerk-${Date.now()}.jpg`] : [],
          createdAt: todayIso(),
          approvedByOffice: false,
          approvedByClient: false,
          rejected: false,
        };
        const trimmed = description;
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              `Meerwerk gemeld: ${trimmed} (${formatEuro(item.amount)})`,
            ),
            ...state.activity,
          ],
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, meerwerk: [...(project.meerwerk ?? []), item] }
              : project,
          ),
        }));
      },

      approveMeerwerkOffice: (projectId, meerwerkId) => {
        const item = get()
          .projects.find((p) => p.id === projectId)
          ?.meerwerk?.find((i) => i.id === meerwerkId);
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  meerwerk: (project.meerwerk ?? []).map((m) =>
                    m.id === meerwerkId
                      ? {
                          ...m,
                          approvedByOffice: !m.approvedByOffice,
                          rejected: false,
                        }
                      : m,
                  ),
                }
              : project,
          ),
        }));
        if (item) {
          logChange(
            set,
            projectId,
            `Meerwerk "${item.description}": kantoor ${
              item.approvedByOffice ? "akkoord ingetrokken" : "akkoord"
            }`,
          );
        }
      },

      approveMeerwerkClient: (projectId, meerwerkId) => {
        const item = get()
          .projects.find((p) => p.id === projectId)
          ?.meerwerk?.find((i) => i.id === meerwerkId);
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  meerwerk: (project.meerwerk ?? []).map((m) =>
                    m.id === meerwerkId
                      ? {
                          ...m,
                          approvedByClient: !m.approvedByClient,
                          rejected: false,
                        }
                      : m,
                  ),
                }
              : project,
          ),
        }));
        if (item) {
          logChange(
            set,
            projectId,
            `Meerwerk "${item.description}": opdrachtgever ${
              item.approvedByClient ? "akkoord ingetrokken" : "akkoord"
            }`,
          );
        }
      },

      toggleMeerwerkDone: (projectId, meerwerkId) => {
        const item = get()
          .projects.find((p) => p.id === projectId)
          ?.meerwerk?.find((i) => i.id === meerwerkId);
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  meerwerk: (project.meerwerk ?? []).map((m) =>
                    m.id === meerwerkId ? { ...m, done: !m.done } : m,
                  ),
                }
              : project,
          ),
        }));
        if (item) {
          logChange(
            set,
            projectId,
            `Meerwerk "${item.description}": ${item.done ? "heropend" : "afgerond"}`,
          );
        }
      },

      rejectMeerwerk: (projectId, meerwerkId, by = "office") => {
        const item = get()
          .projects.find((p) => p.id === projectId)
          ?.meerwerk?.find((i) => i.id === meerwerkId);
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  meerwerk: (project.meerwerk ?? []).map((m) =>
                    m.id === meerwerkId
                      ? {
                          ...m,
                          rejected: true,
                          rejectedBy: by,
                          approvedByOffice: false,
                          approvedByClient: false,
                        }
                      : m,
                  ),
                }
              : project,
          ),
        }));
        if (item) {
          logChange(
            set,
            projectId,
            `Meerwerk "${item.description}": afgewezen door ${
              by === "client" ? "opdrachtgever" : "kantoor"
            }`,
          );
        }
      },

      toggleMateriaalDone: (projectId, werkbonId, taskId, materiaalId) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        const before = task?.materials.find((m) => m.id === materiaalId);
        patchTask(set, projectId, werkbonId, taskId, (current) => ({
          ...current,
          materials: current.materials.map((m) =>
            m.id === materiaalId ? { ...m, done: !m.done } : m,
          ),
        }));
        if (before) {
          logChange(
            set,
            projectId,
            `${scope} - ${before.label || before.name || "taak"}: ${
              before.done ? "heropend" : "afgerond"
            }`,
          );
        }
      },

      completeAllTaken: (projectId) => {
        let changed = 0;
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            return {
              ...project,
              werkbonnen: (project.werkbonnen ?? []).map((wb) => ({
                ...wb,
                tasks: wb.tasks.map((task) => ({
                  ...task,
                  materials: task.materials.map((m) => {
                    if (m.name.trim() && !m.done) changed += 1;
                    return m.name.trim() ? { ...m, done: true } : m;
                  }),
                })),
              })),
            };
          }),
        }));
        if (changed > 0) {
          logChange(
            set,
            projectId,
            `${changed} ${changed === 1 ? "taak" : "taken"} in één keer afgevinkt`,
          );
        }
      },

      setMateriaalUsage: (projectId, werkbonId, taskId, materiaalId, used) => {
        const { task, scope } = taskScope(get, projectId, werkbonId, taskId);
        const before = task?.materials.find((m) => m.id === materiaalId);
        patchTask(set, projectId, werkbonId, taskId, (current) => ({
          ...current,
          materials: current.materials.map((m) =>
            m.id === materiaalId ? { ...m, usedQuantity: clampNumber(used) } : m,
          ),
        }));
        if (before && (before.usedQuantity ?? 0) !== clampNumber(used)) {
          const diff = clampNumber(used) - before.quantity;
          const suffix =
            diff > 0
              ? ` (${diff} ${before.unit} meer dan gepland)`
              : diff < 0
                ? ` (${-diff} ${before.unit} minder dan gepland)`
                : "";
          logChange(
            set,
            projectId,
            `Verbruik ${before.name || "product"} bij ${scope}: ${
              before.usedQuantity ?? 0
            } naar ${clampNumber(used)} ${before.unit}${suffix}`,
          );
        }
      },

      addOpnamePhoto: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const opname = project.opname ?? { photos: [], notes: "" };
            return {
              ...project,
              opname: {
                ...opname,
                photos: [...opname.photos, `opname-${Date.now()}.jpg`],
              },
            };
          }),
        }));
      },

      setOpnameNotes: (projectId, notes) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const opname = project.opname ?? { photos: [], notes: "" };
            return { ...project, opname: { ...opname, notes: clampText(notes) } };
          }),
        }));
      },

      // Calculatie: vul normprijzen in op regels die nog geen prijs hebben.
      applyNormPrices: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const lineItems = project.quote.lineItems.map((line) =>
              line.unitPrice > 0
                ? line
                : { ...line, unitPrice: normPriceFor(line.unit) },
            );
            const next: Project = {
              ...project,
              quote: {
                ...project.quote,
                amount: recalcQuoteAmount(lineItems),
                lineItems,
              },
            };
            return { ...next, ...deriveProjectFromQuote(next) };
          }),
        }));
      },

      initOplevering: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            if (project.oplevering && project.oplevering.checklist.length > 0) {
              return project;
            }
            const item = (label: string, key: string): OpleverItem => ({
              id: `opl-${projectId}-${key}`,
              label,
              done: false,
            });
            return {
              ...project,
              oplevering: {
                checklist: [
                  item("Werk uitgevoerd volgens opdracht", "werk"),
                  item("Voor- en na-foto's gemaakt", "fotos"),
                  item("Brandwerende doorvoeringen geregistreerd", "brandwerend"),
                  item("Meerwerk afgestemd en akkoord", "meerwerk"),
                  item("Werkplek opgeruimd opgeleverd", "opruimen"),
                  item("Kwaliteitscontrole akkoord", "kwaliteit"),
                ],
                photos: [],
                restpunten: "",
              },
            };
          }),
        }));
      },

      toggleOpleverItem: (projectId, itemId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId || !project.oplevering) return project;
            return {
              ...project,
              oplevering: {
                ...project.oplevering,
                checklist: project.oplevering.checklist.map((item) =>
                  item.id === itemId ? { ...item, done: !item.done } : item,
                ),
              },
            };
          }),
        }));
      },

      addOpleverPhoto: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId || !project.oplevering) return project;
            return {
              ...project,
              oplevering: {
                ...project.oplevering,
                photos: [
                  ...project.oplevering.photos,
                  `oplevering-${Date.now()}.jpg`,
                ],
              },
            };
          }),
        }));
      },

      setRestpunten: (projectId, restpunten) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId || !project.oplevering) return project;
            return {
              ...project,
              oplevering: { ...project.oplevering, restpunten: clampText(restpunten) },
            };
          }),
        }));
      },

      signOplevering: (projectId, signedBy) => {
        const name = clampText(signedBy).trim();
        if (!name) return;
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              `Oplevering ondertekend door ${name}`,
            ),
            ...state.activity,
          ],
          projects: state.projects.map((project) => {
            if (project.id !== projectId || !project.oplevering) return project;
            return {
              ...project,
              oplevering: {
                ...project.oplevering,
                signedBy: name,
                completedAt: todayIso(),
              },
            };
          }),
        }));
      },

      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
          purchaseLists: state.purchaseLists.filter(
            (list) => list.projectId !== projectId,
          ),
          activity: state.activity.filter(
            (entry) => entry.projectId !== projectId,
          ),
        }));
      },

      addProjectComment: (projectId, body) => {
        const trimmed = clampText(body).trim();
        if (!trimmed) return;
        set((state) => ({
          activity: [
            makeActivity(projectId, state.activeProfileId, "comment", trimmed),
            ...state.activity,
          ],
        }));
      },

      acceptQuote: (projectId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current) return state;
          const fromStatus = current.status;
          const log =
            fromStatus !== "operatie"
              ? [
                  makeActivity(
                    projectId,
                    state.activeProfileId,
                    "status_change",
                    "Offerte geaccepteerd - project naar Operatie",
                    fromStatus,
                    "operatie",
                  ),
                  ...state.activity,
                ]
              : state.activity;
          return {
            activity: log,
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              const readiness = getProjectMaterialReadiness(project);
              return {
                ...project,
                blocker:
                  readiness === "available"
                    ? undefined
                    : project.blocker ?? "Niet alle materialen zijn beschikbaar.",
                nextStep:
                  readiness === "available"
                    ? "Project plannen"
                    : "Inkooplijst maken",
                quote: {
                  ...project.quote,
                  acceptedDate: todayIso(),
                  status: "accepted",
                },
                status: "operatie",
                urgency: readiness === "available" ? project.urgency : "blocked",
              };
            }),
          };
        });
      },

      completeIntake: (projectId, data) => {
        const insulationType = clampText(data.insulationType);
        const squareMeters = clampNumber(data.squareMeters);
        const blocker = data.blocker ? clampText(data.blocker) : undefined;
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              blocker ? `Intake afgerond met blokkade: ${blocker}` : "Intake afgerond",
            ),
            ...state.activity,
          ],
          projects: state.projects.map((item) => {
            if (item.id !== projectId) return item;
            const updated: Project = {
              ...item,
              insulationType,
              squareMeters,
              blocker: blocker ?? item.blocker,
              urgency: blocker ? "blocked" : item.urgency,
              intake: {
                ...item.intake,
                insulationType,
                squareMeters,
                cavityWidthMm: data.cavityWidthMm ?? item.intake.cavityWidthMm,
                existingInsulation:
                  data.existingInsulation ?? item.intake.existingInsulation,
                buildingType:
                  data.buildingType !== undefined
                    ? clampText(data.buildingType)
                    : item.intake.buildingType,
                accessibility:
                  data.accessibility !== undefined
                    ? clampText(data.accessibility)
                    : item.intake.accessibility,
                estimatedLaborHours:
                  data.estimatedLaborHours !== undefined
                    ? clampNumber(data.estimatedLaborHours)
                    : item.intake.estimatedLaborHours,
                notes:
                  data.notes !== undefined
                    ? clampText(data.notes)
                    : item.intake.notes,
                risks:
                  data.risks !== undefined
                    ? clampText(data.risks)
                    : item.intake.risks,
                photos: item.intake.photos.length
                  ? item.intake.photos
                  : ["intake-bedrijfslocatie.jpg"],
                status: "completed",
              },
              nextStep: blocker ? "Blokkade afhandelen" : "Offerte versturen",
            };

            // Stel meteen een offerte-concept op uit type + m² (de intake
            // bepaalt het werk, dus de offerte kan vast worden voorbereid).
            const lineItems =
              updated.quote.lineItems.length === 0
                ? deriveQuoteLineItems(updated, updated.intake)
                : updated.quote.lineItems;
            const amount = recalcQuoteAmount(lineItems);

            return {
              ...updated,
              value: updated.quote.lineItems.length === 0 ? amount : updated.value,
              quote: {
                ...updated.quote,
                amount,
                lineItems,
              },
              materialRequirements:
                updated.materialRequirements.length === 0
                  ? deriveMaterialRequirements(updated, state.inventory)
                  : updated.materialRequirements,
            };
          }),
        }));
      },

      resolveBlocker: (projectId, note) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current || !current.blocker) return state;
          const trimmed = note ? clampText(note).trim() : "";
          return {
            activity: [
              makeActivity(
                projectId,
                state.activeProfileId,
                "system",
                `Blokkade afgehandeld: ${current.blocker}${trimmed ? ` (${trimmed})` : ""}`,
              ),
              ...state.activity,
            ],
            projects: state.projects.map((item) =>
              item.id === projectId
                ? {
                    ...item,
                    blocker: undefined,
                    urgency: item.urgency === "blocked" ? "normal" : item.urgency,
                    nextStep: "Offerte versturen",
                  }
                : item,
            ),
          };
        });
      },

      sendQuote: (projectId) => {
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              "Offerte verstuurd naar klant",
            ),
            ...state.activity,
          ],
          projects: state.projects.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  nextStep: "Wachten op akkoord",
                  quote: {
                    ...item.quote,
                    sentDate: item.quote.sentDate ?? todayIso(),
                    status: "sent",
                  },
                }
              : item,
          ),
        }));
      },

      acceptQuoteOnly: (projectId) => {
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              "Offerte akkoord, door naar werkvoorbereiding",
            ),
            ...state.activity,
          ],
          projects: state.projects.map((item) => {
            if (item.id !== projectId) return item;
            // Akkoord op het concept: door naar werkvoorbereiding. Zonder
            // akkoord blijft het een concept.
            const fromConcept = getStage(item) === "concept";
            return {
              ...item,
              stage: fromConcept ? "in_progress" : item.stage,
              status: fromConcept
                ? statusForStage("in_progress")
                : item.status,
              nextStep: "Werkbon voorbereiden",
              quote: {
                ...item.quote,
                acceptedDate: item.quote.acceptedDate ?? todayIso(),
                sentDate: item.quote.sentDate ?? todayIso(),
                status: "accepted",
              },
            };
          }),
        }));
        get().ensureWerkbon(projectId);
      },

      completeWorkOrders: (projectId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return;
        project.workOrders
          .filter((wo) => wo.status !== "completed")
          .forEach((wo) =>
            get().updateWorkOrderStatus(projectId, wo.id, "completed"),
          );
      },

      advanceProject: (projectId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) {
          return {
            advanced: false,
            message: "Project niet gevonden",
          };
        }

        if (project.status === "verkoop") {
          if (project.intake.status !== "completed") {
            set((state) => ({
              projects: state.projects.map((item) =>
                item.id === projectId
                  ? {
                      ...item,
                      intake: {
                        ...item.intake,
                        photos: item.intake.photos.length
                          ? item.intake.photos
                          : ["intake-bedrijfslocatie.jpg"],
                        status: "completed",
                      },
                      nextStep: "Offerte versturen",
                    }
                  : item,
              ),
            }));
            return { advanced: true, message: "Intake afgerond" };
          }
          if (project.quote.status === "draft") {
            set((state) => ({
              activity: [
                makeActivity(
                  projectId,
                  state.activeProfileId,
                  "system",
                  "Offerte verstuurd naar klant",
                ),
                ...state.activity,
              ],
              projects: state.projects.map((item) =>
                item.id === projectId
                  ? {
                      ...item,
                      nextStep: "Wachten op akkoord",
                      quote: {
                        ...item.quote,
                        sentDate: todayIso(),
                        status: "sent",
                      },
                    }
                  : item,
              ),
            }));
            return { advanced: true, message: "Offerte verstuurd" };
          }
          if (project.quote.status === "sent") {
            get().acceptQuote(projectId);
            return { advanced: true, message: "Offerte geaccepteerd" };
          }
          // already accepted but still in verkoop somehow: move to operatie
          get().acceptQuote(projectId);
          return { advanced: true, message: "Project verplaatst naar Operatie" };
        }

        if (project.status === "operatie") {
          if (getProjectMaterialReadiness(project) !== "available") {
            const openList = get().purchaseLists.find(
              (list) => list.projectId === projectId && !list.receivedAt,
            );
            if (openList) {
              get().receivePurchaseList(projectId, openList.id);
              return { advanced: true, message: "Bestelling ontvangen, voorraad bijgewerkt" };
            }
            const purchaseList = get().createPurchaseList(projectId);
            return {
              advanced: Boolean(purchaseList),
              message: purchaseList
                ? "Inkooplijst gemaakt, materialen besteld"
                : "Materialen ontbreken nog",
            };
          }
          if (project.workOrders.length === 0) {
            get().markProjectPlanned(projectId);
            return { advanced: true, message: "Project ingepland" };
          }
          const activeWorkOrder =
            project.workOrders.find((wo) => wo.status !== "completed") ??
            project.workOrders[0];
          if (activeWorkOrder.status === "planned") {
            get().updateWorkOrderStatus(projectId, activeWorkOrder.id, "in_progress");
            return { advanced: true, message: "Werk gestart" };
          }
          if (activeWorkOrder.status === "in_progress" || activeWorkOrder.status === "on_the_way") {
            get().updateWorkOrderStatus(projectId, activeWorkOrder.id, "completed");
            return { advanced: true, message: "Werkbon afgerond" };
          }
          // all completed → afronding
          set((state) => ({
            projects: state.projects.map((item) =>
              item.id === projectId
                ? { ...item, nextStep: "Oplevercheck uitvoeren", status: "afronding" }
                : item,
            ),
          }));
          return { advanced: true, message: "Project verplaatst naar Afronding" };
        }

        if (project.status === "afronding") {
          if (!isDeliveryComplete(project)) {
            set((state) => ({
              projects: state.projects.map((item) => {
                if (item.id !== projectId) return item;
                const closed = {
                  ...item,
                  deliveryChecklist: {
                    ...item.deliveryChecklist,
                    items: item.deliveryChecklist.items.map((check) => ({
                      ...check,
                      complete: true,
                    })),
                  },
                };
                const totals = deriveInvoiceTotals(closed);
                return {
                  ...closed,
                  invoice: {
                    ...closed.invoice,
                    ...totals,
                    status:
                      closed.invoice.status === "not_started"
                        ? "draft"
                        : closed.invoice.status,
                  },
                  nextStep: "Factuur versturen",
                };
              }),
            }));
            return { advanced: true, message: "Oplevering afgerond" };
          }
          if (project.invoice.status === "not_started") {
            get().createInvoiceDraft(projectId);
            return { advanced: true, message: "Factuurconcept klaargezet" };
          }
          if (project.invoice.status === "draft") {
            get().sendInvoice(projectId);
            return { advanced: true, message: "Factuur verstuurd" };
          }
          if (project.invoice.status === "sent") {
            get().markInvoicePaid(projectId);
            return { advanced: true, message: "Factuur betaald" };
          }
          return { advanced: false, message: "Project is volledig afgerond" };
        }

        return { advanced: false, message: "Onbekende fase" };
      },

      completeDelivery: (projectId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current || !isDeliveryComplete(current)) return state;
          const log =
            current.status !== "afronding"
              ? [
                  makeActivity(
                    projectId,
                    state.activeProfileId,
                    "status_change",
                    "Oplevering afgerond",
                    current.status,
                    "afronding",
                  ),
                  ...state.activity,
                ]
              : state.activity;
          return {
            activity: log,
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              const totals = deriveInvoiceTotals(project);
              return {
                ...project,
                invoice: {
                  ...project.invoice,
                  ...totals,
                  status:
                    project.invoice.status === "not_started"
                      ? "draft"
                      : project.invoice.status,
                },
                nextStep: "Factuur verzenden",
                status: "afronding",
              };
            }),
          };
        });
      },

      createInvoiceDraft: (projectId) => {
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              "Factuurconcept aangemaakt",
            ),
            ...state.activity,
          ],
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const totals = deriveInvoiceTotals(project);
            return {
              ...project,
              invoice: {
                ...project.invoice,
                ...totals,
                status: "draft",
              },
              nextStep: "Factuur verzenden",
            };
          }),
        }));
      },

      createProject: (input) => {
        const customer = get().customers.find((item) => item.id === input.customerId);
        if (!customer) return undefined;

        const projectNumber = nextProjectNumber(get().projects);
        const newProject = buildEmptyProject(input, customer, projectNumber);

        set((state) => ({
          projects: [newProject, ...state.projects],
        }));

        return newProject;
      },

      addQuoteLineItem: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const newLineItem: QuoteLineItem = {
              description: "",
              id: `ql-${projectId}-${Date.now()}`,
              werksoort: "Warme leidingisolatie",
              size: "",
              quantity: 1,
              unit: "m",
              unitPrice: 0,
            };
            const lineItems = [...project.quote.lineItems, newLineItem];
            const next: Project = {
              ...project,
              quote: {
                ...project.quote,
                amount: recalcQuoteAmount(lineItems),
                lineItems,
              },
            };
            return { ...next, ...deriveProjectFromQuote(next) };
          }),
        }));
      },

      addQuoteLineFromCatalog: (projectId, catalogItemId, quantity) => {
        const item =
          get().articles.find((article) => article.id === catalogItemId) ??
          findCatalogItem(catalogItemId);
        if (!item) return;
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const newLineItem: QuoteLineItem = {
              catalogItemId: item.id,
              description: item.name,
              id: `ql-${projectId}-${Date.now()}`,
              quantity: quantity ?? item.defaultQuantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
            };
            const lineItems = [...project.quote.lineItems, newLineItem];
            const next: Project = {
              ...project,
              quote: {
                ...project.quote,
                amount: recalcQuoteAmount(lineItems),
                lineItems,
                status: project.quote.status === "accepted" ? "accepted" : "draft",
              },
            };
            return { ...next, ...deriveProjectFromQuote(next) };
          }),
        }));
      },

      removeQuoteLineItem: (projectId, lineItemId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const lineItems = project.quote.lineItems.filter(
              (item) => item.id !== lineItemId,
            );
            const next: Project = {
              ...project,
              quote: {
                ...project.quote,
                amount: recalcQuoteAmount(lineItems),
                lineItems,
              },
            };
            return { ...next, ...deriveProjectFromQuote(next) };
          }),
        }));
      },

      updateQuoteLineItem: (projectId, lineItemId, patch) => {
        const safePatch: Partial<QuoteLineItem> = {
          ...patch,
          ...(patch.description !== undefined
            ? { description: clampText(patch.description) }
            : {}),
          ...(patch.quantity !== undefined
            ? { quantity: clampNumber(patch.quantity) }
            : {}),
          ...(patch.unit !== undefined ? { unit: clampText(patch.unit) } : {}),
          ...(patch.unitPrice !== undefined
            ? { unitPrice: clampNumber(patch.unitPrice) }
            : {}),
        };
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const lineItems = project.quote.lineItems.map((item) =>
              item.id === lineItemId ? { ...item, ...safePatch } : item,
            );
            const next: Project = {
              ...project,
              quote: {
                ...project.quote,
                amount: recalcQuoteAmount(lineItems),
                lineItems,
              },
            };
            return { ...next, ...deriveProjectFromQuote(next) };
          }),
        }));
      },

      createPurchaseList: (projectId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return undefined;

        const missingItems = project.materialRequirements
          .filter((item) => item.quantityInStock < item.quantityNeeded)
          .map((item) => ({
            materialName: item.materialName,
            quantityToOrder: item.quantityNeeded - item.quantityInStock,
            supplier: item.supplier,
            unit: item.unit,
          }));

        if (missingItems.length === 0) return undefined;

        const purchaseList: PurchaseList = {
          createdAt: todayIso(),
          id: `pl-${projectId}-${Date.now()}`,
          items: missingItems,
          projectId,
        };

        set((state) => ({
          projects: state.projects.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  blocker: "Materialen moeten besteld worden.",
                  nextStep: "Bestelling opvolgen",
                  status: "operatie",
                  urgency: "blocked",
                }
              : item,
          ),
          purchaseLists: [purchaseList, ...state.purchaseLists],
        }));

        return purchaseList;
      },

      receivePurchaseList: (projectId, purchaseListId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return false;

        const openList = get().purchaseLists.find((list) =>
          purchaseListId
            ? list.id === purchaseListId
            : list.projectId === projectId && !list.receivedAt,
        );
        if (!openList || openList.receivedAt) return false;

        const receivedAt = todayIso();

        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "system",
              `Bestelling ontvangen en ingeboekt (${openList.items.length} regels)`,
            ),
            ...state.activity,
          ],
          projects: state.projects.map((item) => {
            if (item.id !== projectId) return item;

            const materialRequirements = item.materialRequirements.map((req) =>
              req.quantityInStock < req.quantityNeeded
                ? { ...req, quantityInStock: req.quantityNeeded }
                : req,
            );

            return {
              ...item,
              materialRequirements,
              blocker: undefined,
              nextStep: "Project plannen",
              urgency: "normal",
            };
          }),
          purchaseLists: state.purchaseLists.map((list) =>
            list.id === openList.id ? { ...list, receivedAt } : list,
          ),
        }));

        return true;
      },

      markProjectPlanned: (projectId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current || !canMoveToPlanned(current)) return state;
          const fromStatus = current.status;
          const plannedDate = current.plannedDate ?? "2026-05-20";

          return {
            activity: [
              makeActivity(
                projectId,
                state.activeProfileId,
                "status_change",
                "Project ingepland",
                fromStatus,
                "operatie",
              ),
              ...state.activity,
            ],
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              return {
                ...project,
                nextStep: "Werkorder voorbereiden",
                plannedDate,
                planningItems:
                  project.planningItems.length > 0
                    ? project.planningItems
                    : [
                        {
                          date: plannedDate,
                          endTime: "15:30",
                          id: `plan-${project.id}`,
                          installerIds: project.installerIds,
                          projectId: project.id,
                          projectLeaderId: project.projectLeaderId,
                          startTime: "08:00",
                          teamLeaderId: project.teamLeaderId,
                          vehicle: "Bus 8 - Transit",
                        },
                      ],
                status: "operatie",
                workOrders:
                  project.workOrders.length > 0
                    ? project.workOrders
                    : [
                        {
                          assignedTeam: "Team West",
                          checklist: deriveWorkOrderChecklist(project.id),
                          date: plannedDate,
                          id: `wo-${project.id}`,
                          installerIds: project.installerIds,
                          notes:
                            `Werkbon automatisch opgesteld uit intake. ${project.intake.notes || ""}`.trim(),
                          photos: [],
                          projectId: project.id,
                          requiredMaterials: project.materialRequirements,
                          status: "planned",
                          tasks: deriveWorkOrderTasks(project.insulationType),
                          teamLeaderId: project.teamLeaderId,
                          usedMaterials: [],
                        },
                      ],
              };
            }),
          };
        });
      },

      schedulePlanningSlot: (projectId, date, teamLeaderId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current) return state;
          const leader = state.teamMembers.find((m) => m.id === teamLeaderId);
          return {
            activity: [
              makeActivity(
                projectId,
                state.activeProfileId,
                "scheduled",
                `Ingepland op ${date}${leader ? ` (team ${leader.name})` : ""}`,
              ),
              ...state.activity,
            ],
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;

              const existing = project.planningItems[0];
              const planningItem: PlanningItem = existing
                ? { ...existing, date, teamLeaderId }
                : {
                    date,
                    endTime: "15:30",
                    id: `plan-${project.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    installerIds: project.installerIds,
                    projectId: project.id,
                    projectLeaderId: project.projectLeaderId,
                    startTime: "08:00",
                    teamLeaderId,
                    vehicle: "Bus - nog toewijzen",
                  };

              const shouldAdvanceToOperatie =
                project.status === "verkoop" &&
                project.quote.status === "accepted";

              return {
                ...project,
                nextStep: shouldAdvanceToOperatie
                  ? "Werkorder voorbereiden"
                  : project.nextStep,
                plannedDate: date,
                planningItems: [planningItem, ...project.planningItems.slice(1)],
                status: shouldAdvanceToOperatie ? "operatie" : project.status,
                teamLeaderId,
              };
            }),
          };
        });
      },

      scheduleProjectOnDay: (projectId, date) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current) return state;
          // Verplaatsen: behoud de looptijd door de einddatum mee te schuiven.
          const oldStart = current.plannedDate;
          const oldEnd = current.plannedEndDate ?? current.plannedDate;
          const spanMs =
            oldStart && oldEnd ? Date.parse(oldEnd) - Date.parse(oldStart) : 0;
          const newEnd =
            spanMs > 0
              ? new Date(Date.parse(date) + spanMs).toISOString().slice(0, 10)
              : undefined;
          return {
            activity: [
              makeActivity(
                projectId,
                state.activeProfileId,
                "scheduled",
                `Ingepland op ${date}`,
              ),
              ...state.activity,
            ],
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              const shouldAdvance =
                project.status === "verkoop" &&
                project.quote.status === "accepted";
              return {
                ...project,
                plannedDate: date,
                plannedEndDate: newEnd,
                status: shouldAdvance ? "operatie" : project.status,
                nextStep: shouldAdvance
                  ? "Werkorder voorbereiden"
                  : project.nextStep,
              };
            }),
          };
        });
      },

      setProjectDurationDays: (projectId, days) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId || !project.plannedDate) return project;
            const clamped = Math.max(1, Math.round(days));
            const end =
              clamped <= 1
                ? undefined
                : new Date(
                    Date.parse(project.plannedDate) +
                      (clamped - 1) * 86_400_000,
                  )
                    .toISOString()
                    .slice(0, 10);
            return { ...project, plannedEndDate: end };
          }),
        }));
      },

      unscheduleProject: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, plannedDate: undefined, plannedEndDate: undefined }
              : project,
          ),
        }));
      },

      toggleProjectInstaller: (projectId, memberId) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  installerIds: project.installerIds.includes(memberId)
                    ? project.installerIds.filter((id) => id !== memberId)
                    : [...project.installerIds, memberId],
                }
              : project,
          ),
        }));
      },

      moveProjectToStatus: (projectId, status) => {
        const project = get().projects.find((item) => item.id === projectId);

        if (!project) {
          return {
            message: "Project niet gevonden",
            moved: false,
          };
        }

        if (project.status === status) {
          return {
            message: `Project staat al op ${projectStatusLabels[status]}`,
            moved: false,
          };
        }

        const fromStatus = project.status;
        set((state) => ({
          activity: [
            makeActivity(
              projectId,
              state.activeProfileId,
              "status_change",
              `Status van ${projectStatusLabels[fromStatus]} naar ${projectStatusLabels[status]}`,
              fromStatus,
              status,
            ),
            ...state.activity,
          ],
          projects: state.projects.map((item) => {
            if (item.id !== projectId) return item;

            const movedProject: Project = {
              ...item,
              // Materialen die nog besteld moeten worden zijn een normale stap in
              // Operatie, geen blokkade. De blokkade blijft voor intake-risico's.
              invoice:
                status === "afronding"
                  ? {
                      ...item.invoice,
                      ...deriveInvoiceTotals(item),
                      status:
                        item.invoice.status === "not_started"
                          ? "draft"
                          : item.invoice.status,
                    }
                  : item.invoice,
              nextStep: nextStepByManualStatus[status],
              quote:
                status === "operatie" || status === "afronding"
                  ? {
                      ...item.quote,
                      acceptedDate: item.quote.acceptedDate ?? todayIso(),
                      sentDate: item.quote.sentDate ?? todayIso(),
                      status: "accepted",
                    }
                  : item.quote,
              status,
            };

            return movedProject;
          }),
        }));

        return {
          message: `Project verplaatst naar ${projectStatusLabels[status]}`,
          moved: true,
        };
      },

      moveToMaterialsCheck: (projectId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current) return state;
          const log =
            current.status !== "operatie"
              ? [
                  makeActivity(
                    projectId,
                    state.activeProfileId,
                    "status_change",
                    "Materialencheck gestart",
                    current.status,
                    "operatie",
                  ),
                  ...state.activity,
                ]
              : state.activity;
          return {
            activity: log,
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              const readiness = getProjectMaterialReadiness(project);
              return {
                ...project,
                blocker:
                  readiness === "available"
                    ? undefined
                    : project.blocker ?? "Niet alle materialen zijn beschikbaar.",
                nextStep:
                  readiness === "available"
                    ? "Project plannen"
                    : "Inkooplijst maken",
                status: "operatie",
                urgency: readiness === "available" ? project.urgency : "blocked",
              };
            }),
          };
        });
      },

      resetDemo: () => {
        set({
          activity: [],
          customers: mockCustomers,
          projects: cloneProjects(),
          purchaseLists: [],
          teamMembers: mockTeamMembers,
        });
      },

      sendInvoice: (projectId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current) return state;
          return {
            activity: [
              makeActivity(
                projectId,
                state.activeProfileId,
                "status_change",
                "Factuur verstuurd",
                current.status,
                "afronding",
              ),
              ...state.activity,
            ],
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              const totals = deriveInvoiceTotals(project);
              return {
                ...project,
                invoice: {
                  ...project.invoice,
                  ...totals,
                  sentDate: todayIso(),
                  status: "sent",
                },
                nextStep: "Betaling opvolgen",
                status: "afronding",
              };
            }),
          };
        });
      },

      setActiveProfile: (profileId) => {
        set({ activeProfileId: profileId });
      },

      markInvoicePaid: (projectId) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          if (!current) return state;
          return {
            activity: [
              makeActivity(
                projectId,
                state.activeProfileId,
                "status_change",
                "Factuur gemarkeerd als betaald",
                current.status,
                "afronding",
              ),
              ...state.activity,
            ],
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              return {
                ...project,
                invoice: {
                  ...project.invoice,
                  paidDate: todayIso(),
                  status: "paid",
                },
                nextStep: "Afgerond",
                status: "afronding",
              };
            }),
          };
        });
      },

      updateDeliveryItem: (projectId, itemId, complete) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  deliveryChecklist: {
                    ...project.deliveryChecklist,
                    items: project.deliveryChecklist.items.map((item) =>
                      item.id === itemId ? { ...item, complete } : item,
                    ),
                  },
                }
              : project,
          ),
        }));
      },

      updateIntake: (projectId, intake) => {
        const safeIntake: Partial<Intake> = {
          ...intake,
          ...(intake.notes !== undefined
            ? { notes: clampText(intake.notes) }
            : {}),
          ...(intake.risks !== undefined
            ? { risks: clampText(intake.risks) }
            : {}),
          ...(intake.address !== undefined
            ? { address: clampText(intake.address) }
            : {}),
          ...(intake.insulationType !== undefined
            ? { insulationType: clampText(intake.insulationType) }
            : {}),
          ...(intake.squareMeters !== undefined
            ? { squareMeters: clampNumber(intake.squareMeters) }
            : {}),
          ...(intake.estimatedLaborHours !== undefined
            ? { estimatedLaborHours: clampNumber(intake.estimatedLaborHours) }
            : {}),
        };
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextIntake: Intake = {
              ...project.intake,
              ...safeIntake,
            };
            return {
              ...project,
              address: safeIntake.address?.split(",")[0] ?? project.address,
              intake: nextIntake,
            };
          }),
        }));
      },

      updateWorkOrderStatus: (projectId, workOrderId, status) => {
        set((state) => {
          const current = state.projects.find((p) => p.id === projectId);
          const logEntries: ProjectActivity[] = [];
          if (current && status === "completed") {
            logEntries.push(
              makeActivity(
                projectId,
                state.activeProfileId,
                "system",
                "Werkbon afgerond",
              ),
            );
          }
          if (current && status === "blocked") {
            logEntries.push(
              makeActivity(
                projectId,
                state.activeProfileId,
                "system",
                "Issue gemeld op werkbon",
              ),
            );
          }
          return {
            activity:
              logEntries.length > 0
                ? [...logEntries, ...state.activity]
                : state.activity,
            projects: state.projects.map((project) => {
              if (project.id !== projectId) return project;
              const updatedWorkOrders = project.workOrders.map((workOrder) =>
                workOrder.id === workOrderId
                  ? {
                      ...workOrder,
                      endTime: status === "completed" ? "15:30" : workOrder.endTime,
                      startTime:
                        status === "in_progress" && !workOrder.startTime
                          ? "08:05"
                          : workOrder.startTime,
                      status,
                    }
                  : workOrder,
              );
              return {
                ...project,
                nextStep:
                  status === "completed"
                    ? "Naar afronding"
                    : status === "blocked"
                      ? "Issue oplossen"
                      : "Uitvoering volgen",
                urgency: status === "blocked" ? "blocked" : project.urgency,
                workOrders: updatedWorkOrders,
              };
            }),
          };
        });
      },

      addWorkOrderPhoto: (projectId, workOrderId) => {
        const photoName = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            return {
              ...project,
              workOrders: project.workOrders.map((wo) =>
                wo.id === workOrderId
                  ? { ...wo, photos: [...wo.photos, photoName] }
                  : wo,
              ),
            };
          }),
        }));
      },

      addWorkOrderNote: (projectId, workOrderId, note) => {
        const trimmed = clampText(note).trim();
        if (!trimmed) return;
        const stamped = `${new Date().toISOString().slice(11, 16)} - ${trimmed}`;
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            return {
              ...project,
              workOrders: project.workOrders.map((wo) =>
                wo.id === workOrderId
                  ? {
                      ...wo,
                      notes: wo.notes ? `${wo.notes}\n${stamped}` : stamped,
                    }
                  : wo,
              ),
            };
          }),
        }));
      },

      addExtraWork: (projectId, description, amount) => {
        const safeAmount = clampNumber(amount);
        const safeDescription = clampText(description).trim();
        if (safeAmount <= 0 || !safeDescription) return;
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const newAmount = clampNumber(
              project.invoice.extraWorkAmount + safeAmount,
            );
            const extraNote = `Meerwerk: ${safeDescription} (+ €${safeAmount})`;
            return {
              ...project,
              intake: {
                ...project.intake,
                notes: project.intake.notes
                  ? clampText(`${project.intake.notes}\n${extraNote}`)
                  : extraNote,
              },
              invoice: {
                ...project.invoice,
                extraWorkAmount: newAmount,
              },
            };
          }),
        }));
      },
    }),
    {
      name: "opero-state-leeg-v1",
      version: 2,
      // v2: zet het personeel op de actuele roster (projectleiders, voorman,
      // monteurs). Klanten, projecten en activiteit blijven behouden.
      migrate: (persisted, version) => {
        const state = persisted as { teamMembers?: TeamMember[] };
        if (version < 2) {
          state.teamMembers = mockTeamMembers;
        }
        return persisted as OperoState;
      },
      partialize: (state) => ({
        activeProfileId: state.activeProfileId,
        activity: state.activity,
        articles: state.articles,
        customers: state.customers,
        projects: state.projects,
        projectsViewByProfile: state.projectsViewByProfile,
        purchaseLists: state.purchaseLists,
        teamMembers: state.teamMembers,
      }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
