import type { Employee, TeamRole } from "@prisma/client";

// DTO mapper — never return raw rows with internal columns to clients.

export function employeeDto(e: Employee) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    email: e.email ?? undefined,
    roles: e.roles,
    status: e.status,
  };
}

// The list view (per the design) also needs a single "function" label and a
// work-order count (how many projects the employee is assigned to).
type EmployeeWithStats = Employee & {
  _count: {
    projectsAsLeader: number;
    projectsAsTeamLeader: number;
    projectsAsInstaller: number;
  };
};

// Pick the most senior/relevant role as the displayed function.
const ROLE_ORDER: TeamRole[] = [
  "ProjectLeader",
  "Foreman",
  "WorkPlanner",
  "Planner",
  "Technician",
  "Administration",
  "Sales",
];

function primaryRole(roles: TeamRole[]): TeamRole | null {
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return roles[0] ?? null;
}

export function employeeListDto(e: EmployeeWithStats) {
  const workOrderCount =
    e._count.projectsAsLeader +
    e._count.projectsAsTeamLeader +
    e._count.projectsAsInstaller;
  return {
    ...employeeDto(e),
    function: primaryRole(e.roles),
    workOrderCount,
  };
}

export const employeeListInclude = {
  _count: {
    select: {
      projectsAsLeader: true,
      projectsAsTeamLeader: true,
      projectsAsInstaller: true,
    },
  },
} as const;
