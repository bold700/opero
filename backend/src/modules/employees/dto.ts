import type { Employee, EmployeeAbsence, User } from "@prisma/client";
import { accountDto, accountInclude } from "../users/dto.js";

// DTO mapper — never return raw rows with internal columns to clients.

// The login account linked to this employee. Shared with the customers module
// so both screens describe an account identically.
export { accountDto };
type LinkedUser = Pick<User, "id" | "email" | "role" | "roles" | "status" | "activatedAt">;

export function employeeDto(e: Employee & { users?: LinkedUser[] }) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    email: e.email ?? undefined,
    role: e.role,
    status: e.status,
    account: accountDto(e.users),
  };
}

// The list view (per the design) also needs a single "function" label and a
// work-order count. The column is labelled "Werkbonnen" (employees.table.workOrders),
// so it counts WERKBONNEN, not projects.
type EmployeeWithStats = Employee & {
  users?: LinkedUser[];
  _count: {
    assignedWorkOrders: number;
  };
};


export function employeeListDto(e: EmployeeWithStats) {
  // Werkbonnen assigned to this employee. Assignment lives on
  // WorkOrder.assignees (m:n) since the Project→WorkOrder migration — the old
  // sum of the three PROJECT-side relations counted projects, not werkbonnen,
  // and returned 0 for anyone assigned the modern way.
  //
  // Only assignedWorkOrders is counted, deliberately. Adding the project-side
  // relations back would mix two different units (projects + werkbonnen) under
  // one "Werkbonnen" header, and would double count: a project leader is
  // normally also an assignee on that project's werkbonnen, and a Prisma
  // `_count` cannot dedupe across separate relations. Task-level assignment
  // (assignedTasks) is likewise excluded — several zones of the SAME werkbon
  // would each add one.
  const workOrderCount = e._count.assignedWorkOrders;
  return {
    ...employeeDto(e),
    // `function` is the displayed job title. It stays in the DTO (the list
    // column and the client's EmployeeRow both read it) but is now simply the
    // single stored role — there is no array left to pick a primary from.
    function: e.role,
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
      // Werkbon-level assignment is the authoritative one (see employeeListDto).
      assignedWorkOrders: true,
    },
  },
} as const;
