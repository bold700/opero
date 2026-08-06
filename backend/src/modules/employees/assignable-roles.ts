import { z } from "zod";
import type { TeamRole } from "@prisma/client";

// Which JOB TITLES (TeamRole) are eligible for which kind of assignment.
//
// This is NOT authorization. Authorization is UserRole's job and lives in
// @opero/shared permissions.ts. This is a data-quality helper: it keeps the
// project-leader picker from offering the whole payroll, and it is what the
// write paths check so the API can't be handed something the UI would never
// have offered.
//
// One source of truth on purpose: GET /work-orders/assignable?role=... filters
// with exactly the sets the projects write routes validate against, so a person
// the picker shows can always be saved, and a person it hides is always
// refused.

// Leading a project is a supervisory title.
export const PROJECT_LEADER_ROLES: TeamRole[] = ["ProjectLeader", "Foreman"];

// Doing the work on site. Foreman ("meewerkend uitvoerder") is included
// deliberately: they work alongside the crew, so they are assignable as one.
export const TECHNICIAN_ROLES: TeamRole[] = ["Technician", "Foreman"];

// The English query-param values. `role` narrows the assignable list; omitting
// it returns everyone active, which is what the unfiltered pickers still want.
export const assignableRoleFilterSchema = z.enum(["project_leader", "technician"]);
export type AssignableRoleFilter = z.infer<typeof assignableRoleFilterSchema>;

export function rolesFor(filter: AssignableRoleFilter): TeamRole[] {
  return filter === "project_leader" ? PROJECT_LEADER_ROLES : TECHNICIAN_ROLES;
}

// Employees with NO job title set stay eligible everywhere, by design.
//
// The title is optional (a new hire may have none yet) and it is pure metadata,
// so a strict filter would hand an org that never filled it in an empty picker
// and no way to assign anyone — a dead end the user cannot escape from inside
// the app. Narrowing the list must never become a lock-out: untitled staff are
// shown and are accepted on write. Only someone whose title is set AND is wrong
// for the slot is filtered out.
export function assignableWhere(filter: AssignableRoleFilter) {
  return { OR: [{ role: { in: rolesFor(filter) } }, { role: null }] };
}

// Is this employee's job title acceptable for the slot? Mirrors
// assignableWhere() exactly — untitled staff pass.
export function roleAllows(
  filter: AssignableRoleFilter,
  role: TeamRole | null,
): boolean {
  return role === null || rolesFor(filter).includes(role);
}
