import type { Prisma } from "@prisma/client";
import { canSeeAllProjects } from "@opero/shared";
import type { AuthUser } from "../../auth/types.js";

// Returns a Prisma `where` fragment that is combined with orgId +
// deletedAt:null on every list/detail query, so visibility is enforced
// uniformly at the data layer.
//
// - admin/office/foreman: every project in the org (foreman = meewerkend
//                 uitvoerder — org-wide werkbon+planning visibility is his
//                 whole role; office POWERS stay behind isOffice).
// - client:       only projects of their linked customer (customerId match).
// - technician:   projects where their employee is teamLeaderId OR
//                 projectLeaderId OR one of the installers (m:n), OR that hold
//                 a werkbon assigned to them.
//
// That last arm is NOT optional. Werkbon assignment is per WERKBON, not per
// project (../work-orders/visibility.ts) — a monteur is dispatched to a visit
// without necessarily being on the project's crew. The werkbon detail screen
// loads the parent project too, so without this arm the werkbon opens (200)
// and the project 404s, and the page dies on "Project not found". Keep the two
// rules in sync: anything that grants werkbon access must grant read access to
// its project.
//
// This widens READ only. It does not widen the werkbon list inside a project —
// GET /:id scopes that separately via projectIncludeFor (../projects/dto.ts) —
// nor writes, which gate on canViewProject below.
//
// The office check MUST come first and be explicit. The final branch is a
// fallthrough, so anyone not named above silently lands in the technician
// "assigned only" case — and an office user has no assignments, so they'd get
// an empty app with HTTP 200 and no error anywhere.
export function visibleProjectsWhere(
  user: AuthUser,
): Prisma.ProjectWhereInput {
  if (canSeeAllProjects(user.role)) return {};

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
      // Holds a werkbon on this project — assigned to the visit itself, or to
      // one of its zones. Mirrors visibleWorkOrdersWhere.
      {
        workOrders: {
          some: {
            OR: [
              { assignees: { some: { id: employeeId } } },
              { tasks: { some: { assigneeId: employeeId } } },
            ],
          },
        },
      },
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
  if (canSeeAllProjects(user.role)) return true;
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
