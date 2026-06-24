import type { TaakMateriaal, Werkbon, WerkbonTaak } from "@prisma/client";
import { canSeePrices, type UserRole } from "@opero/shared";

// DTO mappers — never return raw rows with internal columns to clients.
//
// CRITICAL: monteurs (and any role where canSeePrices(role) === false) must not
// see prices. On TaakMateriaal that means stripping `unitPrice` (the only money
// field on the shared line-item row); there are no other derived totals exposed
// here — project.value lives on the project DTO, not the werkbon DTO.

// Shape of a werkbon loaded with its nested tasks → materials.
export type WerkbonWithRelations = Werkbon & {
  tasks: (WerkbonTaak & { materials: TaakMateriaal[] })[];
};

function materiaalDto(m: TaakMateriaal, showPrices: boolean) {
  return {
    id: m.id,
    taskId: m.taskId,
    label: m.label ?? undefined,
    name: m.name,
    quantity: m.quantity,
    usedQuantity: m.usedQuantity ?? undefined,
    unit: m.unit,
    diameter: m.diameter ?? undefined,
    // Price stripped for monteurs / non-price roles.
    ...(showPrices ? { unitPrice: m.unitPrice ?? undefined } : {}),
    onSite: m.onSite,
    done: m.done,
    note: m.note ?? undefined,
    ordinal: m.ordinal,
  };
}

function taskDto(
  t: WerkbonTaak & { materials: TaakMateriaal[] },
  showPrices: boolean,
) {
  return {
    id: t.id,
    werkbonId: t.werkbonId,
    description: t.description,
    done: t.done,
    day: t.day ?? undefined,
    beforePhotos: t.beforePhotos,
    resultPhotos: t.resultPhotos,
    startedAt: t.startedAt ?? undefined,
    endedAt: t.endedAt ?? undefined,
    hours: t.hours ?? undefined,
    note: t.note ?? undefined,
    ordinal: t.ordinal,
    materials: [...t.materials]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((m) => materiaalDto(m, showPrices)),
  };
}

// Full nested werkbon DTO. Takes the requesting role so prices are stripped for
// monteurs / klant where canSeePrices is false.
export function werkbonDto(wb: WerkbonWithRelations, role: UserRole) {
  const showPrices = canSeePrices(role);
  return {
    id: wb.id,
    projectId: wb.projectId,
    title: wb.title,
    drawings: wb.drawings,
    approvedByOpzichter: wb.approvedByOpzichter,
    ordinal: wb.ordinal,
    tasks: [...wb.tasks]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((t) => taskDto(t, showPrices)),
  };
}

// Prisma include used to load the full werkbon aggregate (tasks → materials).
export const werkbonInclude = {
  tasks: { include: { materials: true } },
} as const;
