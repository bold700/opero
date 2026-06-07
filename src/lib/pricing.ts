import {
  type InventoryItem,
  type Intake,
  type MaterialRequirement,
  type Project,
  type QuoteLineItem,
} from "@/lib/types";

export const HOURLY_RATE = 65;
export const VEHICLE_FEE = 95;

type IsolationRate = {
  materialPerM2: number;
  hoursPerM2: number;
  defaultMaterials: { name: string; unit: string; perM2: number }[];
};

const isolationRates: Record<string, IsolationRate> = {
  Spouwmuurisolatie: {
    defaultMaterials: [
      { name: "EPS-parels", perM2: 0.45, unit: "m3" },
    ],
    hoursPerM2: 0.18,
    materialPerM2: 18,
  },
  "Dakisolatie binnenzijde": {
    defaultMaterials: [
      { name: "PIR-platen 60mm", perM2: 1.05, unit: "m2" },
    ],
    hoursPerM2: 0.3,
    materialPerM2: 28,
  },
  "Dakisolatie buitenzijde": {
    defaultMaterials: [
      { name: "PIR-platen 100mm", perM2: 1.05, unit: "m2" },
      { name: "Daksingels", perM2: 1.1, unit: "m2" },
    ],
    hoursPerM2: 0.45,
    materialPerM2: 52,
  },
  Vloerisolatie: {
    defaultMaterials: [
      { name: "PIR-platen 80mm", perM2: 1.05, unit: "m2" },
    ],
    hoursPerM2: 0.22,
    materialPerM2: 24,
  },
  Bodemisolatie: {
    defaultMaterials: [
      { name: "EPS-parels", perM2: 0.4, unit: "m3" },
    ],
    hoursPerM2: 0.2,
    materialPerM2: 22,
  },
  "Gevelisolatie buitenzijde": {
    defaultMaterials: [
      { name: "Minerale wol panelen", perM2: 1.05, unit: "m2" },
      { name: "Stuc en eindlaag", perM2: 1, unit: "m2" },
    ],
    hoursPerM2: 0.6,
    materialPerM2: 78,
  },
};

const fallbackRate: IsolationRate = {
  defaultMaterials: [{ name: "Isolatiemateriaal", perM2: 1, unit: "post" }],
  hoursPerM2: 0.25,
  materialPerM2: 25,
};

export function rateFor(type: string) {
  return isolationRates[type] ?? fallbackRate;
}

export function estimateLaborHours(insulationType: string, squareMeters: number) {
  return Math.max(4, Math.round(rateFor(insulationType).hoursPerM2 * squareMeters));
}

export function deriveQuoteLineItems(
  project: Project,
  intake: Pick<Intake, "estimatedLaborHours" | "insulationType" | "squareMeters">,
): QuoteLineItem[] {
  const baseId = `ql-${project.id}-auto`;
  const rate = rateFor(intake.insulationType);
  const m2 = Math.max(0, intake.squareMeters);
  const hours =
    intake.estimatedLaborHours > 0
      ? intake.estimatedLaborHours
      : estimateLaborHours(intake.insulationType, m2);

  return [
    {
      description: `${intake.insulationType || "Werk"} - levering en montage`,
      id: `${baseId}-material`,
      quantity: m2,
      unit: "m2",
      unitPrice: rate.materialPerM2,
    },
    {
      description: "Arbeid en uitvoering",
      id: `${baseId}-labor`,
      quantity: hours,
      unit: "uur",
      unitPrice: HOURLY_RATE,
    },
    {
      description: "Voorrijden en logistiek",
      id: `${baseId}-vehicle`,
      quantity: 1,
      unit: "post",
      unitPrice: VEHICLE_FEE,
    },
  ];
}

export function deriveMaterialRequirements(
  project: Project,
  inventory: InventoryItem[],
): MaterialRequirement[] {
  const intake = project.intake;
  const rate = rateFor(intake.insulationType || project.insulationType);
  const m2 = Math.max(0, project.squareMeters || intake.squareMeters);

  const fromIntake =
    intake.estimatedMaterials.length > 0
      ? intake.estimatedMaterials.map((name, index) => {
          const matched = inventory.find((item) =>
            item.materialName.toLowerCase().includes(name.toLowerCase()),
          );
          const fallback = rate.defaultMaterials[index] ?? rate.defaultMaterials[0];
          const quantityNeeded = matched
            ? Math.max(1, Math.round((fallback?.perM2 ?? 1) * m2 * 10) / 10)
            : Math.max(1, Math.round((fallback?.perM2 ?? 1) * m2 * 10) / 10);
          return {
            expectedDeliveryDate: undefined,
            id: `mr-${project.id}-${index}`,
            materialId: matched?.materialId ?? `mat-${index}`,
            materialName: matched?.materialName ?? name,
            quantityInStock: matched?.quantityInStock ?? 0,
            quantityNeeded,
            supplier: matched?.supplier ?? "Onbekend",
            unit: matched?.unit ?? fallback?.unit ?? "post",
          };
        })
      : rate.defaultMaterials.map((material, index) => {
          const matched = inventory.find(
            (item) =>
              item.materialName.toLowerCase() === material.name.toLowerCase(),
          );
          const quantityNeeded =
            Math.max(1, Math.round(material.perM2 * m2 * 10) / 10) || 1;
          return {
            expectedDeliveryDate: undefined,
            id: `mr-${project.id}-${index}`,
            materialId: matched?.materialId ?? `mat-${index}`,
            materialName: material.name,
            quantityInStock: matched?.quantityInStock ?? 0,
            quantityNeeded,
            supplier: matched?.supplier ?? "Standaard leverancier",
            unit: material.unit,
          };
        });

  return fromIntake;
}

export function deriveWorkOrderTasks(insulationType: string) {
  return [
    "Werkplek inrichten en veilig afzetten",
    `${insulationType || "Isolatie"} aanbrengen volgens werkmethode`,
    "Verbruik en fotos registreren",
    "Eindcontrole met contactpersoon",
  ];
}

export function deriveWorkOrderChecklist(projectId: string) {
  return [
    {
      complete: false,
      id: `wo-${projectId}-check-1`,
      label: "Werkplek veilig afgezet",
    },
    {
      complete: false,
      id: `wo-${projectId}-check-2`,
      label: "Materiaal verbruik genoteerd",
    },
    {
      complete: false,
      id: `wo-${projectId}-check-3`,
      label: "Eindcontrole met contactpersoon gedaan",
    },
  ];
}

export function deriveInvoiceTotals(project: Project): {
  acceptedQuoteAmount: number;
  laborAmount: number;
  materialsAmount: number;
  extraWorkAmount: number;
} {
  const quote = project.quote.amount;
  const lineItems = project.quote.lineItems;
  const laborLine = lineItems.find((line) => line.unit === "uur");
  const materialLines = lineItems.filter((line) => line.unit !== "uur");
  const laborAmount = laborLine
    ? Math.round(laborLine.quantity * laborLine.unitPrice)
    : Math.round(
        estimateLaborHours(project.insulationType, project.squareMeters) *
          HOURLY_RATE,
      );
  const materialsAmount = materialLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPrice),
    0,
  );

  return {
    acceptedQuoteAmount: quote,
    extraWorkAmount: 0,
    laborAmount,
    materialsAmount,
  };
}
