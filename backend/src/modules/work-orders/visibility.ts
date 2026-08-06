import type { Prisma } from "@prisma/client";
import { canSeeAllProjects } from "@opero/shared";
import type { AuthUser } from "../../auth/types.js";

// WORK-ORDER visibility. This is deliberately NOT the same question as project
// visibility (../projects/visibility.ts).
//
// A project is a grouping that can hold many werkbonnen, and assignment is per
// WERKBON (WorkOrder.assignees, m:n) — a crew is dispatched to a visit, not to
// the whole job. Scoping werkbonnen by PROJECT membership therefore leaks: a
// monteur put on one visit of a project would see every sibling werkbon of that
// project, including visits belonging to another crew.
//
// - admin/office/foreman: every werkbon in the org (canSeeAllProjects).
// - client:               every werkbon of their own customer's projects — a
//                         customer sees the whole job they are paying for.
// - technician:           ONLY werkbonnen they are an assignee of, plus ones
//                         where they hold a zone (task) assignment, since a
//                         monteur can be attached at either level (the list
//                         filter uses the same two-level rule).
//
// The office check MUST come first. The final branch is a fallthrough, so any
// role not named above lands in the strict "assigned only" case rather than
// silently getting org-wide access.
export function visibleWorkOrdersWhere(
  user: AuthUser,
): Prisma.WorkOrderWhereInput {
  if (canSeeAllProjects(user.role)) return {};

  if (user.role === "client") {
    // `__none__` makes the filter match nothing if the user has no customer.
    return { project: { is: { customerId: user.customerId ?? "__none__" } } };
  }

  // technician — assignment at werkbon level OR at zone level.
  return assignedToEmployeeWhere(user.employeeId);
}

// "This werkbon is assigned to THIS employee" — werkbon level (assignees, m:n)
// OR zone level (tasks.assigneeId). Both arms are required: since the
// Project→WorkOrder migration the office dispatches a monteur to the visit
// itself, so a query matching only the task arm silently misses him.
//
// Separate from visibleWorkOrdersWhere on purpose. That one answers "may this
// user READ this werkbon", which is org-wide ({}) for admin/office/FOREMAN — a
// foreman holds real assignments too, so reusing it to build a *personal* feed
// (notifications) would hand him every werkbon in the org.
export function assignedToEmployeeWhere(
  employeeId: string | null | undefined,
): Prisma.WorkOrderWhereInput {
  // `__none__` makes the filter match nothing if the user has no employee.
  const id = employeeId ?? "__none__";
  return {
    OR: [
      { assignees: { some: { id } } },
      { tasks: { some: { assigneeId: id } } },
    ],
  };
}

// Full scope (org + soft-delete + visibility) for a work-order query.
//
// Fragments are combined with AND, never spread: both `visibility` (technician →
// { OR: [...assigned...] }) and `extra` (e.g. a search → { OR: [...fields...] })
// can carry a top-level OR, and a naive spread would let one overwrite the other
// and SILENTLY DROP the visibility scope. Same bug class as projectScopeWhere.
export function workOrderScopeWhere(
  user: AuthUser,
  extra?: Prisma.WorkOrderWhereInput,
): Prisma.WorkOrderWhereInput {
  return {
    AND: [
      { project: { is: { orgId: user.orgId, deletedAt: null } } },
      visibleWorkOrdersWhere(user),
      ...(extra ? [extra] : []),
    ],
  };
}

// True when a loaded work order is one the user may see/act on. The in-memory
// counterpart of visibleWorkOrdersWhere, for a record already fetched.
export function canViewWorkOrder(
  user: AuthUser,
  workOrder: {
    project: { customerId: string };
    assignees?: { id: string }[];
    tasks?: { assigneeId: string | null }[];
  },
): boolean {
  if (canSeeAllProjects(user.role)) return true;
  if (user.role === "client") {
    return workOrder.project.customerId === user.customerId;
  }
  // technician
  const employeeId = user.employeeId;
  if (!employeeId) return false;
  return (
    (workOrder.assignees ?? []).some((a) => a.id === employeeId) ||
    (workOrder.tasks ?? []).some((t) => t.assigneeId === employeeId)
  );
}
