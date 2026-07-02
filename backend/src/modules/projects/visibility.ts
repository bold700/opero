import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../../auth/types.js";

// Port of `getVisibleProjectsForProfile` (client/src/lib/roles.ts) for the
// 3-role auth model (admin / technician / client). Returns a Prisma `where`
// fragment that is combined with orgId + deletedAt:null on every list/detail
// query, so visibility is enforced uniformly at the data layer.
//
// - admin:      every project in the org.
// - client:     only projects of their linked customer (customerId match).
// - technician: only projects where their employee is teamLeaderId OR
//               projectLeaderId OR one of the installers (m:n).
export function visibleProjectsWhere(
  user: AuthUser,
): Prisma.ProjectWhereInput {
  if (user.role === "admin") return {};

  if (user.role === "client") {
    // `__none__` makes the filter match nothing if the user has no customer.
    return { customerId: user.customerId ?? "__none__" };
  }

  // technician
  const employeeId = user.employeeId ?? "__none__";
  return {
    OR: [
      { teamLeaderId: employeeId },
      { projectLeaderId: employeeId },
      { installers: { some: { id: employeeId } } },
    ],
  };
}

// Full scope (org + soft-delete + visibility) for a project query.
export function projectScopeWhere(
  user: AuthUser,
  extra?: Prisma.ProjectWhereInput,
): Prisma.ProjectWhereInput {
  const visibility = visibleProjectsWhere(user);
  // CAUTION: both `visibility` (technician → { OR: [...assigned...] }) and `extra`
  // (e.g. the planning calendar-presence { OR: [plannedDate, planningItems] }) can
  // each carry a top-level `OR`. A naive spread would let one `OR` overwrite the
  // other and SILENTLY DROP the visibility scope — that's how a technician could
  // see every scheduled project. Combine via AND so both constraints always hold.
  return {
    AND: [
      { orgId: user.orgId, deletedAt: null },
      visibility,
      ...(extra ? [extra] : []),
    ],
  };
}

// True when a loaded project is one the user is allowed to act on. Used for
// technician/client write-gating (e.g. comment on own/assigned project).
export function canViewProject(
  user: AuthUser,
  project: {
    customerId: string;
    teamLeaderId: string | null;
    projectLeaderId: string | null;
    installers?: { id: string }[];
  },
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "client") return project.customerId === user.customerId;
  // technician
  const employeeId = user.employeeId;
  if (!employeeId) return false;
  return (
    project.teamLeaderId === employeeId ||
    project.projectLeaderId === employeeId ||
    (project.installers ?? []).some((i) => i.id === employeeId)
  );
}
