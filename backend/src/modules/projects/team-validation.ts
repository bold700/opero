import { prisma } from "../../db/client.js";
import { BadRequest } from "../../lib/httpError.js";
import {
  roleAllows,
  type AssignableRoleFilter,
} from "../employees/assignable-roles.js";

// Write-side validation for project team assignment.
//
// Two things are checked, in this order:
//   1. ORG MEMBERSHIP — the employee exists, is not soft-deleted, and belongs
//      to the caller's org. This is the security-relevant half: without it, an
//      id from another tenant could be connected onto this project.
//   2. JOB TITLE — the employee's TeamRole is eligible for the slot, matching
//      exactly what GET /work-orders/assignable?role=... offers, so the API
//      cannot be handed a person the picker would never have shown.
//
// Untitled employees pass both (see assignable-roles.ts): narrowing the picker
// must never make an org unable to assign anyone.

// Validate one employee for a slot. `null`/`undefined` id = clearing the slot,
// which is always allowed.
export async function assertAssignable(
  orgId: string,
  employeeId: string | null | undefined,
  slot: AssignableRoleFilter,
  label: string,
): Promise<void> {
  if (!employeeId) return;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, orgId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!employee) throw BadRequest(`${label} not found in organization`);
  if (!roleAllows(slot, employee.role)) {
    throw BadRequest(`${label} does not have a job title eligible for this role`);
  }
}

// Validate a set of employees for a slot (installers / technicians).
export async function assertAllAssignable(
  orgId: string,
  employeeIds: string[] | undefined,
  slot: AssignableRoleFilter,
  label: string,
): Promise<void> {
  if (employeeIds === undefined) return;
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return;
  const found = await prisma.employee.findMany({
    where: { id: { in: ids }, orgId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (found.length !== ids.length) {
    throw BadRequest(`One or more ${label} not found in organization`);
  }
  if (found.some((e) => !roleAllows(slot, e.role))) {
    throw BadRequest(`One or more ${label} do not have an eligible job title`);
  }
}
