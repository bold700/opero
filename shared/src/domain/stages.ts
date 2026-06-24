import {
  type Project,
  type ProjectStatus,
  type Stage,
  type TaskMaterial,
} from "../types";

export const STAGE_ORDER: Stage[] = [
  "concept",
  "in_progress",
  "ready",
  "done",
];

export const STAGE_LABELS: Record<Stage, string> = {
  concept: "Concept",
  in_progress: "In progress",
  ready: "Ready",
  done: "Done",
};

export function statusForStage(stage: Stage): ProjectStatus {
  if (stage === "concept") return "sales";
  if (stage === "done") return "closing";
  return "operations";
}

// Zet oude fases (6) en oude status om naar de vier statussen.
const STAGE_MIGRATE: Record<string, Stage> = {
  offerte: "concept",
  concept: "concept",
  werkvoorbereiding: "in_progress",
  planning: "in_progress",
  uitvoering: "in_progress",
  in_progress: "in_progress",
  ready: "ready",
  facturatie: "done",
  archief: "done",
  done: "done",
};

// Alle taken (genoemde isolatieregels) zijn afgevinkt.
export function allTasksDone(project: Project): boolean {
  const named = (project.workOrders ?? [])
    .flatMap((workOrder) => workOrder.tasks)
    .flatMap((task) => task.materials)
    .filter((m) => m.name.trim());
  return named.length > 0 && named.every((m) => m.done);
}

export function getStage(project: Project): Stage {
  const stored: Stage = project.stage
    ? (STAGE_MIGRATE[project.stage] ?? "concept")
    : project.status === "operations"
      ? "in_progress"
      : project.status === "closing"
        ? "done"
        : "concept";
  // Afgerond (ondertekend) blijft done. Anders is "ready" afgeleid: zodra alle
  // taken zijn afgevinkt staat het project klaar om af te ronden.
  if (stored === "done") return "done";
  if (allTasksDone(project)) return "ready";
  return stored;
}

export function stageIndex(project: Project): number {
  return STAGE_ORDER.indexOf(getStage(project));
}

export function isPaid(project: Project): boolean {
  return project.invoice.status === "paid";
}

export function extraWorkApproved(item: {
  approvedByOffice: boolean;
  approvedByClient: boolean;
  rejected: boolean;
}): boolean {
  return item.approvedByOffice && item.approvedByClient && !item.rejected;
}

export function approvedExtraWorkTotal(project: Project): number {
  return (project.extraWork ?? [])
    .filter(extraWorkApproved)
    .reduce((sum, item) => sum + item.amount, 0);
}

// Eén gedeelde regelset (alle isolatieregels van alle workOrders). Offerte en
// factuur zijn views op dezelfde regels.
function eachLine(project: Project): TaskMaterial[] {
  return (project.workOrders ?? []).flatMap((workOrder) =>
    workOrder.tasks.flatMap((task) => task.materials),
  );
}

// Offerte: aantal x prijs (wat je offreert).
export function quoteLineTotal(project: Project): number {
  return eachLine(project).reduce(
    (sum, m) => sum + m.quantity * (m.unitPrice ?? 0),
    0,
  );
}

// Factuur: werkelijk verbruik x prijs (val terug op gepland als er nog geen
// verbruik is ingevuld).
export function consumedLineTotal(project: Project): number {
  return eachLine(project).reduce(
    (sum, m) => sum + (m.usedQuantity ?? m.quantity) * (m.unitPrice ?? 0),
    0,
  );
}

// Het offertebedrag: uit de regels als die er zijn, anders de oude waarde.
export function quoteTotal(project: Project): number {
  const fromLines = quoteLineTotal(project);
  return fromLines > 0 ? fromLines : project.value;
}

export function invoiceTotal(project: Project): number {
  const consumed = consumedLineTotal(project);
  const basis = consumed > 0 ? consumed : project.value;
  return basis + approvedExtraWorkTotal(project);
}

export type PickListItem = {
  name: string;
  unit: string;
  diameter?: number;
  total: number;
  onSite: number;
};

// Rolt alle isolatieregels van alle workOrders op tot één pickList, per
// type isolatie + eenheid + diameter, met hoeveel er al op locatie ligt.
export function projectPickList(project: Project): PickListItem[] {
  const map = new Map<string, PickListItem>();
  for (const workOrder of project.workOrders ?? []) {
    for (const task of workOrder.tasks) {
      for (const m of task.materials) {
        if (!m.name.trim()) continue;
        const key = `${m.name.toLowerCase()}|${m.unit}|${m.diameter ?? ""}`;
        const item =
          map.get(key) ??
          {
            name: m.name,
            unit: m.unit,
            diameter: m.diameter,
            total: 0,
            onSite: 0,
          };
        item.total += m.quantity;
        if (m.onSite) item.onSite += m.quantity;
        map.set(key, item);
      }
    }
  }
  return [...map.values()];
}

