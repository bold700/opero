import {
  type Project,
  type ProjectStatus,
  type Stage,
  type TaakMateriaal,
} from "@/lib/types";

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
  if (stage === "concept") return "verkoop";
  if (stage === "done") return "afronding";
  return "operatie";
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
export function allTakenDone(project: Project): boolean {
  const named = (project.werkbonnen ?? [])
    .flatMap((werkbon) => werkbon.tasks)
    .flatMap((task) => task.materials)
    .filter((m) => m.name.trim());
  return named.length > 0 && named.every((m) => m.done);
}

export function getStage(project: Project): Stage {
  const stored: Stage = project.stage
    ? (STAGE_MIGRATE[project.stage] ?? "concept")
    : project.status === "operatie"
      ? "in_progress"
      : project.status === "afronding"
        ? "done"
        : "concept";
  // Afgerond (ondertekend) blijft done. Anders is "ready" afgeleid: zodra alle
  // taken zijn afgevinkt staat het project klaar om af te ronden.
  if (stored === "done") return "done";
  if (allTakenDone(project)) return "ready";
  return stored;
}

export function stageIndex(project: Project): number {
  return STAGE_ORDER.indexOf(getStage(project));
}

export function isPaid(project: Project): boolean {
  return project.invoice.status === "paid";
}

export function meerwerkApproved(item: {
  approvedByOffice: boolean;
  approvedByClient: boolean;
  rejected: boolean;
}): boolean {
  return item.approvedByOffice && item.approvedByClient && !item.rejected;
}

export function approvedMeerwerkTotal(project: Project): number {
  return (project.meerwerk ?? [])
    .filter(meerwerkApproved)
    .reduce((sum, item) => sum + item.amount, 0);
}

// Eén gedeelde regelset (alle isolatieregels van alle werkbonnen). Offerte en
// factuur zijn views op dezelfde regels.
function eachRegel(project: Project): TaakMateriaal[] {
  return (project.werkbonnen ?? []).flatMap((werkbon) =>
    werkbon.tasks.flatMap((task) => task.materials),
  );
}

// Offerte: aantal x prijs (wat je offreert).
export function offerteRegelTotal(project: Project): number {
  return eachRegel(project).reduce(
    (sum, m) => sum + m.quantity * (m.unitPrice ?? 0),
    0,
  );
}

// Factuur: werkelijk verbruik x prijs (val terug op gepland als er nog geen
// verbruik is ingevuld).
export function verbruiktRegelTotal(project: Project): number {
  return eachRegel(project).reduce(
    (sum, m) => sum + (m.usedQuantity ?? m.quantity) * (m.unitPrice ?? 0),
    0,
  );
}

// Het offertebedrag: uit de regels als die er zijn, anders de oude waarde.
export function offerteTotal(project: Project): number {
  const fromRegels = offerteRegelTotal(project);
  return fromRegels > 0 ? fromRegels : project.value;
}

export function invoiceTotal(project: Project): number {
  const verbruikt = verbruiktRegelTotal(project);
  const basis = verbruikt > 0 ? verbruikt : project.value;
  return basis + approvedMeerwerkTotal(project);
}

export type MeeneemItem = {
  name: string;
  unit: string;
  diameter?: number;
  total: number;
  onSite: number;
};

// Rolt alle isolatieregels van alle werkbonnen op tot één meeneemlijst, per
// type isolatie + eenheid + diameter, met hoeveel er al op locatie ligt.
export function projectMeeneemlijst(project: Project): MeeneemItem[] {
  const map = new Map<string, MeeneemItem>();
  for (const werkbon of project.werkbonnen ?? []) {
    for (const task of werkbon.tasks) {
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

