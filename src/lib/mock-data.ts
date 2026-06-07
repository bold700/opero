import {
  type Customer,
  type DeliveryChecklist,
  type InventoryItem,
  type Invoice,
  type InvoiceStatus,
  type Material,
  type MaterialRequirement,
  type PlanningItem,
  type Project,
  type ProjectStatus,
  type ProjectUrgency,
  type Quote,
  type QuoteStatus,
  type Role,
  type TeamMember,
  type WorkOrder,
  type WorkOrderStatus,
} from "@/lib/types";

export const mockCustomers: Customer[] = [
  {
    address: "Oudegracht 128",
    city: "Utrecht",
    contactName: "Marieke de Vries",
    email: "operations@devriesvastgoed.nl",
    id: "c-001",
    name: "De Vries Vastgoedbeheer",
    notes: "Beheerder van kantoor- en winkelpanden in Utrecht.",
    phone: "06 18 42 73 10",
    postalCode: "3511 AW",
  },
  {
    address: "Bergweg 214",
    city: "Rotterdam",
    contactName: "Sander Noorlander",
    email: "bestuur@vvedelinde.nl",
    id: "c-002",
    name: "VvE De Linde",
    notes: "Zakelijke VvE-opdracht, toegang via gebouwbeheerder.",
    phone: "010 422 18 90",
    postalCode: "3037 EN",
  },
  {
    address: "Gedempte Oude Gracht 42",
    city: "Haarlem",
    contactName: "Niels van Maanen",
    email: "niels@bakkerijmaanen.nl",
    id: "c-003",
    name: "Bakkerij Van Maanen",
    phone: "023 533 90 11",
    postalCode: "2011 GR",
  },
  {
    address: "Stratumsedijk 86",
    city: "Eindhoven",
    contactName: "Ellen Janssen",
    email: "facilitair@janssenkinderopvang.nl",
    id: "c-004",
    name: "Janssen Kinderopvang B.V.",
    notes: "Werk buiten breng- en haaltijden plannen.",
    phone: "06 42 19 80 77",
    postalCode: "5611 NE",
  },
  {
    address: "Hazeldonk 6201",
    city: "Breda",
    contactName: "Ramon Smit",
    email: "planning@smitlogistics.nl",
    id: "c-005",
    name: "Gebr. Smit Logistics",
    notes: "Werk mag alleen buiten laadtijden starten.",
    phone: "076 520 44 12",
    postalCode: "4836 LG",
  },
  {
    address: "Herestraat 71",
    city: "Groningen",
    contactName: "Anke Koster",
    email: "beheer@kostervastgoed.nl",
    id: "c-006",
    name: "Koster Vastgoed Groningen",
    notes: "Kantoorverzamelgebouw met meerdere huurders.",
    phone: "06 55 73 22 18",
    postalCode: "9711 LD",
  },
  {
    address: "Utrechtsestraat 19",
    city: "Amersfoort",
    contactName: "Dr. Farah Meijer",
    email: "praktijk@tandartscentrum.nl",
    id: "c-007",
    name: "Tandartspraktijk Centrum",
    phone: "033 462 41 00",
    postalCode: "3811 LA",
  },
  {
    address: "Velperweg 88",
    city: "Arnhem",
    contactName: "Lisette Bouwman",
    email: "lisette@rijnzichtwonen.nl",
    id: "c-008",
    name: "Woningcorporatie Rijnzicht",
    phone: "026 355 22 01",
    postalCode: "6824 HM",
  },
  {
    address: "Markt 9",
    city: "Delft",
    contactName: "Tessa Vermeer",
    email: "tessa@ateliervermeer.nl",
    id: "c-009",
    name: "Atelier Vermeer",
    phone: "015 214 77 66",
    postalCode: "2611 GP",
  },
  {
    address: "Kerkstraat 33",
    city: "Zwolle",
    contactName: "Peter van Dijk",
    email: "facilitair@vandijkhoreca.nl",
    id: "c-010",
    name: "Van Dijk Horeca Groep",
    notes: "Werk in restaurant alleen op sluitingsdag.",
    phone: "06 21 94 83 64",
    postalCode: "8011 RT",
  },
  {
    address: "Stationsplein 4",
    city: "Tilburg",
    contactName: "Hanneke Vos",
    email: "facilitair@zorgpuntbrabant.nl",
    id: "c-011",
    name: "Zorgpunt Brabant",
    phone: "013 540 18 84",
    postalCode: "5038 CB",
  },
  {
    address: "Prinsengracht 512",
    city: "Amsterdam",
    contactName: "Victor Peeters",
    email: "victor@peetersadvies.nl",
    id: "c-012",
    name: "Peeters Advies",
    phone: "020 812 34 90",
    postalCode: "1017 KH",
  },
];

const monteurNames = [
  "Sven Bakker",
  "Tim de Groot",
  "Ruben Visser",
  "Lars Mulder",
  "Joost de Boer",
  "Niels Janssen",
  "Thijs Bos",
  "Bram Vos",
  "Kevin Dijkstra",
  "Sander Hendriks",
  "Rick van Dijk",
  "Stefan Meijer",
  "Bas Willemsen",
  "Jeroen Peters",
  "Marco Hofman",
  "Dennis Kuiper",
  "Erik Postma",
  "Patrick van Leeuwen",
  "Mike Scholten",
  "Youssef El Amrani",
  "Tom Bakx",
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: "tm-001",
    name: "Wesley van den Berg",
    phone: "06 22 14 88 30",
    email: "wesley@opero.nl",
    roles: ["Projectleider"],
  },
  {
    id: "tm-002",
    name: "Danny Koster",
    phone: "06 24 71 09 52",
    email: "danny@opero.nl",
    roles: ["Projectleider"],
  },
  {
    id: "tm-003",
    name: "Jan Dekker",
    phone: "06 51 38 27 64",
    email: "jan@opero.nl",
    roles: ["Voorman"],
  },
  ...monteurNames.map((name, index) => ({
    id: `tm-${String(index + 4).padStart(3, "0")}`,
    name,
    phone: `06 ${10 + index} ${20 + index} ${30 + index} ${40 + index}`.slice(0, 14),
    roles: ["Monteur"] as Role[],
  })),
];

export const mockMaterials: Material[] = [
  { id: "mat-001", name: "EPS parels HR++", unit: "zak" },
  { id: "mat-002", name: "Minerale wol platen", unit: "pak" },
  { id: "mat-003", name: "PIR dakplaten 120mm", unit: "plaat" },
  { id: "mat-004", name: "Bodemfolie 300mu", unit: "rol" },
  { id: "mat-005", name: "PUR schuim set", unit: "set" },
  { id: "mat-006", name: "Ventilatierooster", unit: "stuk" },
];

export const mockInventory: InventoryItem[] = [
  {
    id: "inv-001",
    materialId: "mat-001",
    materialName: "EPS parels HR++",
    quantityInStock: 84,
    reorderPoint: 30,
    supplier: "IsoGroothandel NL",
    unit: "zak",
  },
  {
    id: "inv-002",
    materialId: "mat-002",
    materialName: "Minerale wol platen",
    quantityInStock: 22,
    reorderPoint: 18,
    supplier: "Bouwmaat Pro",
    unit: "pak",
  },
  {
    id: "inv-003",
    materialId: "mat-003",
    materialName: "PIR dakplaten 120mm",
    quantityInStock: 9,
    reorderPoint: 14,
    supplier: "IsolatiePartner",
    unit: "plaat",
  },
  {
    id: "inv-004",
    materialId: "mat-004",
    materialName: "Bodemfolie 300mu",
    quantityInStock: 12,
    reorderPoint: 5,
    supplier: "FolieDirect",
    unit: "rol",
  },
  {
    id: "inv-005",
    materialId: "mat-005",
    materialName: "PUR schuim set",
    quantityInStock: 3,
    reorderPoint: 6,
    supplier: "FoamSupply",
    unit: "set",
  },
  {
    id: "inv-006",
    materialId: "mat-006",
    materialName: "Ventilatierooster",
    quantityInStock: 44,
    reorderPoint: 20,
    supplier: "Ventilatieland",
    unit: "stuk",
  },
];

type ProjectSeed = {
  id: string;
  projectNumber: string;
  customerId: string;
  insulationType: string;
  squareMeters: number;
  status: ProjectStatus;
  quoteStatus: QuoteStatus;
  intakeDone: boolean;
  invoiceStatus: InvoiceStatus;
  value: number;
  urgency: ProjectUrgency;
  blocker?: string;
  nextStep: string;
  plannedDate?: string;
  materialRequirements: MaterialRequirement[];
  workOrderStatus?: WorkOrderStatus;
  deliveryCompleteIds?: string[];
};

const deliveryLabels = [
  ["work-complete", "Werk uitgevoerd volgens opdracht"],
  ["photos", "Fotos geupload"],
  ["materials", "Materialen geregistreerd"],
  ["extras", "Meerwerk akkoord"],
  ["signature", "Handtekening opdrachtgever"],
  ["quality", "Kwaliteitscheck afgerond"],
] as const;

function requirement(
  id: string,
  materialId: string,
  materialName: string,
  quantityNeeded: number,
  quantityInStock: number,
  unit: string,
  supplier: string,
  expectedDeliveryDate?: string,
): MaterialRequirement {
  return {
    expectedDeliveryDate,
    id,
    materialId,
    materialName,
    quantityInStock,
    quantityNeeded,
    supplier,
    unit,
  };
}

function deliveryChecklist(doneIds: string[] = []): DeliveryChecklist {
  return {
    id: `dc-${doneIds.join("-") || "open"}`,
    items: deliveryLabels.map(([id, label]) => ({
      complete: doneIds.includes(id),
      id,
      label,
    })),
  };
}

function quote(seed: ProjectSeed): Quote {
  return {
    acceptedDate: seed.quoteStatus === "accepted" ? "2026-05-06" : undefined,
    amount: seed.value,
    id: `q-${seed.id}`,
    lineItems: [
      {
        description: `${seed.insulationType} arbeid en voorbereiding`,
        id: `ql-${seed.id}-1`,
        quantity: seed.squareMeters,
        unit: "m2",
        unitPrice: Math.round(seed.value * 0.58) / seed.squareMeters,
      },
      {
        description: "Materialen, afwerking en veiligheidsmiddelen",
        id: `ql-${seed.id}-2`,
        quantity: 1,
        unit: "post",
        unitPrice: Math.round(seed.value * 0.42),
      },
    ],
    sentDate:
      seed.quoteStatus === "sent" || seed.quoteStatus === "accepted"
        ? "2026-05-04"
        : undefined,
    status: seed.quoteStatus,
  };
}

function invoice(seed: ProjectSeed): Invoice {
  const status = seed.invoiceStatus;
  return {
    acceptedQuoteAmount: seed.value,
    extraWorkAmount: status === "paid" ? 420 : 0,
    id: `inv-${seed.id}`,
    laborAmount: Math.round(seed.value * 0.36),
    materialsAmount: Math.round(seed.value * 0.42),
    paidDate: status === "paid" ? "2026-05-13" : undefined,
    sentDate: status === "sent" || status === "paid" ? "2026-05-10" : undefined,
    status,
  };
}

function planning(seed: ProjectSeed): PlanningItem[] {
  if (!seed.plannedDate) return [];

  return [
    {
      date: seed.plannedDate,
      endTime: "15:30",
      id: `plan-${seed.id}`,
      installerIds: seed.projectNumber.endsWith("7")
        ? ["tm-004", "tm-007"]
        : ["tm-004", "tm-005"],
      projectId: seed.id,
      projectLeaderId: "tm-002",
      startTime: "08:00",
      teamLeaderId: seed.projectNumber.endsWith("7") ? "tm-006" : "tm-003",
      vehicle: seed.projectNumber.endsWith("7")
        ? "Bus 12 - Crafter"
        : "Bus 8 - Transit",
    },
  ];
}

function workOrders(seed: ProjectSeed): WorkOrder[] {
  if (!seed.plannedDate || !seed.workOrderStatus) return [];

  return [
    {
      assignedTeam: seed.projectNumber.endsWith("7") ? "Team Noord" : "Team West",
      checklist: [
        {
          complete: seed.workOrderStatus === "completed",
          id: `wo-${seed.id}-check-1`,
          label: "Werkplek veilig afgezet",
        },
        {
          complete: seed.workOrderStatus === "completed",
          id: `wo-${seed.id}-check-2`,
          label: "Materiaal verbruik genoteerd",
        },
        {
          complete: seed.workOrderStatus === "completed",
          id: `wo-${seed.id}-check-3`,
          label: "Eindcontrole met contactpersoon gedaan",
        },
      ],
      customerSignature:
        seed.workOrderStatus === "completed"
          ? "Ondertekend door opdrachtgever"
          : undefined,
      date: seed.plannedDate,
      endTime: seed.workOrderStatus === "completed" ? "15:20" : undefined,
      id: `wo-${seed.id}`,
      installerIds: seed.projectNumber.endsWith("7")
        ? ["tm-004", "tm-007"]
        : ["tm-004", "tm-005"],
      notes:
        seed.workOrderStatus === "blocked"
          ? "Wachten op extra PIR platen."
          : "Let op nette afwerking rond bestaande leidingen.",
      photos: seed.workOrderStatus === "completed" ? ["gevel-na.jpg"] : [],
      projectId: seed.id,
      requiredMaterials: seed.materialRequirements,
      startTime:
        seed.workOrderStatus === "in_progress" ||
        seed.workOrderStatus === "completed"
          ? "08:07"
          : undefined,
      status: seed.workOrderStatus,
      tasks: [
        "Werkplek controleren",
        `${seed.insulationType} aanbrengen`,
        "Verbruik en fotos registreren",
        "Contactpersoon informeren over oplevering",
      ],
      teamLeaderId: seed.projectNumber.endsWith("7") ? "tm-006" : "tm-003",
      usedMaterials:
        seed.workOrderStatus === "completed"
          ? seed.materialRequirements.map((item) => ({
              materialName: item.materialName,
              quantity: Math.min(item.quantityNeeded, item.quantityInStock),
              unit: item.unit,
            }))
          : [],
    },
  ];
}

function makeProject(seed: ProjectSeed): Project {
  const customer = mockCustomers.find((item) => item.id === seed.customerId);

  if (!customer) {
    throw new Error(`Missing customer for ${seed.customerId}`);
  }

  return {
    address: customer.address,
    blocker: seed.blocker,
    city: customer.city,
    customerId: customer.id,
    customerName: customer.name,
    deliveryChecklist: deliveryChecklist(seed.deliveryCompleteIds),
    id: seed.id,
    installerIds: seed.projectNumber.endsWith("7")
      ? ["tm-004", "tm-007"]
      : ["tm-004", "tm-005"],
    insulationType: seed.insulationType,
    intake: {
      address: `${customer.address}, ${customer.postalCode} ${customer.city}`,
      customerDetails: {
        contactName: customer.contactName,
        email: customer.email,
        phone: customer.phone,
      },
      estimatedLaborHours: Math.max(8, Math.round(seed.squareMeters / 8)),
      estimatedMaterials: seed.materialRequirements.map(
        (item) => `${item.quantityNeeded} ${item.unit} ${item.materialName}`,
      ),
      id: `intake-${seed.id}`,
      insulationType: seed.insulationType,
      notes:
        "Zakelijke locatie geschikt voor snelle uitvoering. Toegang vooraf met contactpersoon bevestigen.",
      photos: seed.intakeDone ? ["intake-voorgevel.jpg", "kruipruimte.jpg"] : [],
      plannedDate: seed.intakeDone ? seed.plannedDate ?? "2026-05-14" : undefined,
      risks:
        seed.urgency === "blocked"
          ? seed.blocker ?? "Controleer technische beperking."
          : "Geen bijzonderheden gemeld.",
      squareMeters: seed.squareMeters,
      status: seed.intakeDone ? "completed" : "planned",
    },
    invoice: invoice(seed),
    materialRequirements: seed.materialRequirements,
    nextStep: seed.nextStep,
    plannedDate: seed.plannedDate,
    planningItems: planning(seed),
    postalCode: customer.postalCode,
    projectLeaderId: "tm-002",
    projectNumber: seed.projectNumber,
    quote: quote(seed),
    squareMeters: seed.squareMeters,
    status: seed.status,
    teamLeaderId: seed.projectNumber.endsWith("7") ? "tm-006" : "tm-003",
    urgency: seed.urgency,
    value: seed.value,
    workOrders: workOrders(seed),
  };
}

const completeDeliveryIds = deliveryLabels.map(([id]) => id);

export const mockProjects: Project[] = [
  makeProject({
    customerId: "c-001",
    id: "p-001",
    insulationType: "Spouwmuurisolatie",
    materialRequirements: [
      requirement("mr-001-1", "mat-001", "EPS parels HR++", 18, 84, "zak", "IsoGroothandel NL"),
      requirement("mr-001-2", "mat-006", "Ventilatierooster", 8, 44, "stuk", "Ventilatieland"),
    ],
    intakeDone: false,
    invoiceStatus: "not_started",
    nextStep: "Intake inplannen",
    projectNumber: "OP-2026-001",
    quoteStatus: "draft",
    squareMeters: 92,
    status: "verkoop",
    urgency: "normal",
    value: 3480,
  }),
  makeProject({
    customerId: "c-002",
    id: "p-002",
    insulationType: "Dakisolatie binnenzijde",
    materialRequirements: [
      requirement("mr-002-1", "mat-003", "PIR dakplaten 120mm", 34, 9, "plaat", "IsolatiePartner", "2026-05-22"),
      requirement("mr-002-2", "mat-005", "PUR schuim set", 4, 3, "set", "FoamSupply", "2026-05-20"),
    ],
    intakeDone: false,
    invoiceStatus: "not_started",
    nextStep: "Intake uitvoeren",
    plannedDate: "2026-05-18",
    projectNumber: "OP-2026-002",
    quoteStatus: "draft",
    squareMeters: 160,
    status: "verkoop",
    urgency: "urgent",
    value: 9850,
  }),
  makeProject({
    customerId: "c-003",
    id: "p-003",
    insulationType: "Vloerisolatie",
    materialRequirements: [
      requirement("mr-003-1", "mat-002", "Minerale wol platen", 18, 22, "pak", "Bouwmaat Pro"),
      requirement("mr-003-2", "mat-004", "Bodemfolie 300mu", 3, 12, "rol", "FolieDirect"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Offerte opstellen",
    projectNumber: "OP-2026-003",
    quoteStatus: "draft",
    squareMeters: 78,
    status: "verkoop",
    urgency: "normal",
    value: 5140,
  }),
  makeProject({
    customerId: "c-004",
    id: "p-004",
    insulationType: "Kruipruimte isolatie",
    materialRequirements: [
      requirement("mr-004-1", "mat-004", "Bodemfolie 300mu", 2, 12, "rol", "FolieDirect"),
      requirement("mr-004-2", "mat-001", "EPS parels HR++", 12, 84, "zak", "IsoGroothandel NL"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Wachten op akkoord",
    projectNumber: "OP-2026-004",
    quoteStatus: "sent",
    squareMeters: 64,
    status: "verkoop",
    urgency: "normal",
    value: 3960,
  }),
  makeProject({
    customerId: "c-005",
    id: "p-005",
    insulationType: "Gevelisolatie magazijn",
    materialRequirements: [
      requirement("mr-005-1", "mat-002", "Minerale wol platen", 30, 34, "pak", "Bouwmaat Pro"),
      requirement("mr-005-2", "mat-006", "Ventilatierooster", 16, 44, "stuk", "Ventilatieland"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Materialen controleren",
    projectNumber: "OP-2026-005",
    quoteStatus: "accepted",
    squareMeters: 240,
    status: "operatie",
    urgency: "urgent",
    value: 14800,
  }),
  makeProject({
    blocker: "PIR platen deels niet op voorraad.",
    customerId: "c-006",
    id: "p-006",
    insulationType: "Dakisolatie schuin dak",
    materialRequirements: [
      requirement("mr-006-1", "mat-003", "PIR dakplaten 120mm", 22, 9, "plaat", "IsolatiePartner", "2026-05-23"),
      requirement("mr-006-2", "mat-005", "PUR schuim set", 2, 3, "set", "FoamSupply"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Inkooplijst maken",
    projectNumber: "OP-2026-006",
    quoteStatus: "accepted",
    squareMeters: 112,
    status: "operatie",
    urgency: "blocked",
    value: 7720,
  }),
  makeProject({
    customerId: "c-007",
    id: "p-007",
    insulationType: "Plafondisolatie praktijkruimte",
    materialRequirements: [
      requirement("mr-007-1", "mat-002", "Minerale wol platen", 14, 22, "pak", "Bouwmaat Pro"),
      requirement("mr-007-2", "mat-005", "PUR schuim set", 2, 3, "set", "FoamSupply"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Werkorder klaarzetten",
    plannedDate: "2026-05-16",
    projectNumber: "OP-2026-007",
    quoteStatus: "accepted",
    squareMeters: 58,
    status: "operatie",
    urgency: "normal",
    value: 4420,
    workOrderStatus: "planned",
  }),
  makeProject({
    customerId: "c-008",
    id: "p-008",
    insulationType: "Spouwmuurisolatie complex A",
    materialRequirements: [
      requirement("mr-008-1", "mat-001", "EPS parels HR++", 52, 84, "zak", "IsoGroothandel NL"),
      requirement("mr-008-2", "mat-006", "Ventilatierooster", 24, 44, "stuk", "Ventilatieland"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Uitvoering afronden",
    plannedDate: "2026-05-16",
    projectNumber: "OP-2026-008",
    quoteStatus: "accepted",
    squareMeters: 310,
    status: "operatie",
    urgency: "urgent",
    value: 18950,
    workOrderStatus: "in_progress",
  }),
  makeProject({
    customerId: "c-009",
    deliveryCompleteIds: ["work-complete", "photos", "materials"],
    id: "p-009",
    insulationType: "Binnenwand isolatie atelier",
    materialRequirements: [
      requirement("mr-009-1", "mat-002", "Minerale wol platen", 12, 22, "pak", "Bouwmaat Pro"),
      requirement("mr-009-2", "mat-005", "PUR schuim set", 1, 3, "set", "FoamSupply"),
    ],
    intakeDone: true,
    invoiceStatus: "not_started",
    nextStep: "Oplevercheck afronden",
    plannedDate: "2026-05-13",
    projectNumber: "OP-2026-009",
    quoteStatus: "accepted",
    squareMeters: 48,
    status: "afronding",
    urgency: "normal",
    value: 3180,
    workOrderStatus: "completed",
  }),
  makeProject({
    customerId: "c-010",
    deliveryCompleteIds: completeDeliveryIds,
    id: "p-010",
    insulationType: "Vloerisolatie horecapand",
    materialRequirements: [
      requirement("mr-010-1", "mat-004", "Bodemfolie 300mu", 3, 12, "rol", "FolieDirect"),
      requirement("mr-010-2", "mat-002", "Minerale wol platen", 16, 22, "pak", "Bouwmaat Pro"),
    ],
    intakeDone: true,
    invoiceStatus: "draft",
    nextStep: "Factuurconcept maken",
    plannedDate: "2026-05-09",
    projectNumber: "OP-2026-010",
    quoteStatus: "accepted",
    squareMeters: 88,
    status: "afronding",
    urgency: "normal",
    value: 5680,
    workOrderStatus: "completed",
  }),
  makeProject({
    customerId: "c-011",
    deliveryCompleteIds: completeDeliveryIds,
    id: "p-011",
    insulationType: "Dakisolatie zorglocatie",
    materialRequirements: [
      requirement("mr-011-1", "mat-003", "PIR dakplaten 120mm", 8, 9, "plaat", "IsolatiePartner"),
      requirement("mr-011-2", "mat-005", "PUR schuim set", 2, 3, "set", "FoamSupply"),
    ],
    intakeDone: true,
    invoiceStatus: "sent",
    nextStep: "Betaling opvolgen",
    plannedDate: "2026-05-06",
    projectNumber: "OP-2026-011",
    quoteStatus: "accepted",
    squareMeters: 72,
    status: "afronding",
    urgency: "normal",
    value: 6420,
    workOrderStatus: "completed",
  }),
  makeProject({
    customerId: "c-012",
    deliveryCompleteIds: completeDeliveryIds,
    id: "p-012",
    insulationType: "Kruipruimte en bodemfolie",
    materialRequirements: [
      requirement("mr-012-1", "mat-004", "Bodemfolie 300mu", 2, 12, "rol", "FolieDirect"),
      requirement("mr-012-2", "mat-001", "EPS parels HR++", 10, 84, "zak", "IsoGroothandel NL"),
    ],
    intakeDone: true,
    invoiceStatus: "paid",
    nextStep: "Afgerond",
    plannedDate: "2026-05-03",
    projectNumber: "OP-2026-012",
    quoteStatus: "accepted",
    squareMeters: 54,
    status: "afronding",
    urgency: "normal",
    value: 3720,
    workOrderStatus: "completed",
  }),
];
