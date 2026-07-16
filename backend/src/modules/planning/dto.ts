import type { Prisma } from "@prisma/client";

// DTO mappers for the planning module — never return raw rows with internal
// columns to clients.

// A werkbon (WorkOrder) row carrying just the fields the calendar feed needs,
// plus its planning items (with installers) and its parent project's
// customer/address/number context + team. Scheduling lives on the werkbon.
export const planningWorkOrderInclude = {
  planningItems: {
    include: {
      installers: { select: { id: true } },
      teamLeader: { select: { name: true } },
    },
  },
  assignees: { select: { id: true } },
  project: {
    select: {
      projectNumber: true,
      customerName: true,
      address: true,
      postalCode: true,
      city: true,
      teamLeaderId: true,
      teamLeader: { select: { name: true } },
    },
  },
} satisfies Prisma.WorkOrderInclude;

type PlanningWorkOrder = Prisma.WorkOrderGetPayload<{
  include: typeof planningWorkOrderInclude;
}>;

// One flat calendar entry. A scheduled werkbon surfaces either via a concrete
// PlanningItem (preferred — carries times/vehicle/team) or, when none exists,
// via the werkbon's plannedDate alone. Customer/address/number context comes
// from the parent project.
export type PlanningEntry = {
  workOrderId: string;
  projectId: string;
  projectNumber: string;
  customerName: string;
  address: string;
  city: string;
  date: string;
  startTime?: string;
  endTime?: string;
  plannedEndDate?: string;
  teamLeaderId?: string;
  teamLeaderName?: string;
  installerIds: string[];
  vehicle?: string;
  status: string;
};

// Build the flat list of calendar entries for a single werkbon. Emits one entry
// per PlanningItem; if the werkbon has a plannedDate but no PlanningItems, emits
// a single date-only entry so date-driven scheduling still shows on the
// calendar.
export function planningEntriesForWorkOrder(
  wo: PlanningWorkOrder,
): PlanningEntry[] {
  const assigneeIds = wo.assignees.map((a) => a.id);
  const project = wo.project;

  if (wo.planningItems.length > 0) {
    return wo.planningItems.map((item) => ({
      workOrderId: wo.id,
      projectId: wo.projectId,
      projectNumber: project.projectNumber,
      customerName: project.customerName,
      address: project.address,
      city: project.city,
      date: item.date,
      startTime: item.startTime || undefined,
      endTime: item.endTime || undefined,
      plannedEndDate: wo.plannedEndDate ?? undefined,
      teamLeaderId: item.teamLeaderId ?? project.teamLeaderId ?? undefined,
      teamLeaderName:
        item.teamLeader?.name ?? project.teamLeader?.name ?? undefined,
      installerIds:
        item.installers.length > 0
          ? item.installers.map((i) => i.id)
          : assigneeIds,
      vehicle: item.vehicle || undefined,
      status: wo.listStatus,
    }));
  }

  if (wo.plannedDate) {
    return [
      {
        workOrderId: wo.id,
        projectId: wo.projectId,
        projectNumber: project.projectNumber,
        customerName: project.customerName,
        address: project.address,
        city: project.city,
        date: wo.plannedDate,
        plannedEndDate: wo.plannedEndDate ?? undefined,
        teamLeaderId: project.teamLeaderId ?? undefined,
        teamLeaderName: project.teamLeader?.name ?? undefined,
        installerIds: assigneeIds,
        status: wo.listStatus,
      },
    ];
  }

  return [];
}
