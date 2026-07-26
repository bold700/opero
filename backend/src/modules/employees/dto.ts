import type { Employee, EmployeeAbsence, TeamRole, User } from "@prisma/client";
import { accountDto, accountInclude } from "../users/dto.js";

// DTO mapper — never return raw rows with internal columns to clients.

// The login account linked to this employee. Shared with the customers module
// so both screens describe an account identically.
export { accountDto };
type LinkedUser = Pick<User, "id" | "email" | "role" | "status" | "activatedAt">;

export function employeeDto(e: Employee & { users?: LinkedUser[] }) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    email: e.email ?? undefined,
    roles: e.roles,
    status: e.status,
    account: accountDto(e.users),
  };
}

// The list view (per the design) also needs a single "function" label and a
// work-order count (how many projects the employee is assigned to).
type EmployeeWithStats = Employee & {
  users?: LinkedUser[];
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

// An absence period, always carrying the employee's name so the planning view
// can render "Jan — vakantie 3–17 aug" without a second lookup.
export function absenceDto(
  a: EmployeeAbsence & { employee?: { id: string; name: string } },
) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    employeeName: a.employee?.name,
    kind: a.kind,
    startDate: a.startDate,
    endDate: a.endDate,
    note: a.note ?? undefined,
  };
}

export const employeeListInclude = {
  // Ordered so `users[0]` in accountDto is deterministic.
  users: accountInclude,
  _count: {
    select: {
      projectsAsLeader: true,
      projectsAsTeamLeader: true,
      projectsAsInstaller: true,
    },
  },
} as const;
