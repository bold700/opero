import type { TaskMaterial, WorkOrder, WorkOrderTask } from "@prisma/client";
import { canSeePrices, type UserRole } from "@opero/shared";

// DTO mappers — never return raw rows with internal columns to clients.
//
// CRITICAL: technicians (and any role where canSeePrices(role) === false) must
// not see prices. On TaskMaterial that means stripping `unitPrice` (the only
// money field on the shared line-item row); there are no other derived totals
// exposed here — project.value lives on the project DTO, not the workOrder DTO.

// Shape of a workOrder loaded with its nested tasks → materials.
export type WorkOrderWithRelations = WorkOrder & {
  tasks: (WorkOrderTask & { materials: TaskMaterial[] })[];
};

function materialDto(m: TaskMaterial, showPrices: boolean) {
  return {
    id: m.id,
    taskId: m.taskId,
    label: m.label ?? undefined,
    name: m.name,
    quantity: m.quantity,
    usedQuantity: m.usedQuantity ?? undefined,
    unit: m.unit,
    diameter: m.diameter ?? undefined,
    // Price stripped for technicians / non-price roles.
    ...(showPrices ? { unitPrice: m.unitPrice ?? undefined } : {}),
    onSite: m.onSite,
    done: m.done,
    note: m.note ?? undefined,
    ordinal: m.ordinal,
  };
}

function taskDto(
  t: WorkOrderTask & { materials: TaskMaterial[] },
  showPrices: boolean,
) {
  return {
    id: t.id,
    workOrderId: t.workOrderId,
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
      .map((m) => materialDto(m, showPrices)),
  };
}

// Full nested workOrder DTO. Takes the requesting role so prices are stripped
// for technicians / client where canSeePrices is false.
export function workOrderDto(wb: WorkOrderWithRelations, role: UserRole) {
  const showPrices = canSeePrices(role);
  return {
    id: wb.id,
    projectId: wb.projectId,
    title: wb.title,
    drawings: wb.drawings,
    approvedBySupervisor: wb.approvedBySupervisor,
    ordinal: wb.ordinal,
    tasks: [...wb.tasks]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((t) => taskDto(t, showPrices)),
  };
}

// Prisma include used to load the full workOrder aggregate (tasks → materials).
export const workOrderInclude = {
  tasks: { include: { materials: true } },
} as const;
