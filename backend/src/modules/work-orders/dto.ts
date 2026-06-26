import type { TaskMaterial, WorkOrder, WorkOrderTask } from "@prisma/client";
import { canSeePrices, type UserRole } from "@opero/shared";

// DTO mappers — never return raw rows with internal columns to clients.
//
// CRITICAL: technicians (and any role where canSeePrices(role) === false) must
// not see prices. On TaskMaterial that means stripping `unitPrice` (the only
// money field on the shared line-item row); there are no other derived totals
// exposed here — project.value lives on the project DTO, not the workOrder DTO.

// A task loaded with its materials + the per-zone work type / assignee names.
type TaskWithRelations = WorkOrderTask & {
  materials: TaskMaterial[];
  workType?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
};

// Shape of a workOrder loaded with its nested tasks → materials, plus the
// signer (for the sign-off display).
export type WorkOrderWithRelations = WorkOrder & {
  tasks: TaskWithRelations[];
  signedBy?: { name: string } | null;
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

function taskDto(t: TaskWithRelations, showPrices: boolean) {
  return {
    id: t.id,
    workOrderId: t.workOrderId,
    description: t.description,
    done: t.done,
    day: t.day ?? undefined,
    // Per-zone work type + assignee (id for the dropdown, name for display).
    workTypeId: t.workTypeId ?? undefined,
    workTypeName: t.workType?.name ?? undefined,
    assigneeId: t.assigneeId ?? undefined,
    assigneeName: t.assignee?.name ?? undefined,
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
    // Per-work-order sign-off state.
    signature: wb.signature ?? undefined,
    signedAt: wb.signedAt ? wb.signedAt.toISOString() : undefined,
    signedByName: wb.signedBy?.name ?? undefined,
    tasks: [...wb.tasks]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((t) => taskDto(t, showPrices)),
  };
}

// Prisma include used to load the full workOrder aggregate (tasks → materials,
// plus the signer's name for the sign-off display).
export const workOrderInclude = {
  tasks: {
    include: {
      materials: true,
      workType: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  },
  signedBy: { select: { name: true } },
} as const;

// --- List view ------------------------------------------------------------
// The work-orders list (per the Figma) shows one row per work order with its
// project context: number, customer, location, work type, technician, status,
// date. Status is derived from urgency + task completion.

export type WorkOrderListStatus = "open" | "on_the_way" | "urgent" | "done";

type WorkOrderListSource = WorkOrder & {
  tasks: {
    done: boolean;
    startedAt: string | null;
    workType: { name: string } | null;
    assignee: { name: string } | null;
  }[];
  project: {
    projectNumber: string;
    customerName: string;
    city: string;
    insulationType: string;
    urgency: string;
    teamLeader: { name: string } | null;
  };
};

function deriveListStatus(wb: WorkOrderListSource): WorkOrderListStatus {
  if (wb.project.urgency === "urgent" || wb.project.urgency === "blocked") {
    return "urgent";
  }
  const tasks = wb.tasks;
  if (tasks.length > 0 && tasks.every((t) => t.done)) return "done";
  if (tasks.some((t) => t.done || t.startedAt)) return "on_the_way";
  return "open";
}

// Roll up distinct task-level names; "+N" when more than one. Falls back to the
// project-level value when no task carries one (older / empty work orders).
function rollup(
  names: (string | null | undefined)[],
  fallback: string | null,
): string {
  const distinct = [...new Set(names.filter((n): n is string => !!n))];
  if (distinct.length === 0) return fallback ?? "—";
  if (distinct.length === 1) return distinct[0];
  return `${distinct[0]} +${distinct.length - 1}`;
}

export const workOrderListInclude = {
  tasks: {
    select: {
      done: true,
      startedAt: true,
      workType: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  },
  project: {
    select: {
      projectNumber: true,
      customerName: true,
      city: true,
      insulationType: true,
      urgency: true,
      teamLeader: { select: { name: true } },
    },
  },
} as const;

export function workOrderListDto(wb: WorkOrderListSource) {
  return {
    id: wb.id,
    number: wb.project.projectNumber,
    customerName: wb.project.customerName,
    city: wb.project.city,
    // Work type + technician roll up from the work order's tasks (per-zone),
    // falling back to project-level values when tasks don't set them.
    workType: rollup(
      wb.tasks.map((t) => t.workType?.name),
      wb.project.insulationType,
    ),
    technician: rollup(
      wb.tasks.map((t) => t.assignee?.name),
      wb.project.teamLeader?.name ?? null,
    ),
    status: deriveListStatus(wb),
    date: wb.createdAt.toISOString(),
  };
}
