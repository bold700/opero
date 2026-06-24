import type { Prisma } from "@prisma/client";

// DTO mappers for the planning module — never return raw rows with internal
// columns to clients.

// A project row carrying just the fields the calendar feed needs, plus its
// planning items (with installers) and assigned installers.
export const planningProjectInclude = {
  planningItems: { include: { installers: { select: { id: true } } } },
  installers: { select: { id: true } },
} satisfies Prisma.ProjectInclude;

type PlanningProject = Prisma.ProjectGetPayload<{
  include: typeof planningProjectInclude;
}>;

// One flat calendar entry. A scheduled project surfaces either via a concrete
// PlanningItem (preferred — carries times/vehicle/team) or, when none exists,
// via the project's plannedDate alone.
export type PlanningEntry = {
  projectId: string;
  projectNumber: string;
  customerName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  plannedEndDate?: string;
  teamLeaderId?: string;
  installerIds: string[];
  vehicle?: string;
  status: string;
};

// Build the flat list of calendar entries for a single project. Emits one entry
// per PlanningItem; if the project has a plannedDate but no PlanningItems, emits
// a single date-only entry so date-driven scheduling (scheduleProjectOnDay /
// updateProject.plannedDate) still shows on the calendar.
export function planningEntriesForProject(p: PlanningProject): PlanningEntry[] {
  const projectInstallerIds = p.installers.map((i) => i.id);

  if (p.planningItems.length > 0) {
    return p.planningItems.map((item) => ({
      projectId: p.id,
      projectNumber: p.projectNumber,
      customerName: p.customerName,
      date: item.date,
      startTime: item.startTime || undefined,
      endTime: item.endTime || undefined,
      plannedEndDate: p.plannedEndDate ?? undefined,
      teamLeaderId: item.teamLeaderId ?? p.teamLeaderId ?? undefined,
      installerIds:
        item.installers.length > 0
          ? item.installers.map((i) => i.id)
          : projectInstallerIds,
      vehicle: item.vehicle || undefined,
      status: p.status,
    }));
  }

  if (p.plannedDate) {
    return [
      {
        projectId: p.id,
        projectNumber: p.projectNumber,
        customerName: p.customerName,
        date: p.plannedDate,
        plannedEndDate: p.plannedEndDate ?? undefined,
        teamLeaderId: p.teamLeaderId ?? undefined,
        installerIds: projectInstallerIds,
        status: p.status,
      },
    ];
  }

  return [];
}
