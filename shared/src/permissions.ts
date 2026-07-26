// The Roles & Permissions matrix, encoded cell-for-cell from the authoritative
// spec at docs/roles-and-permissions.md. THAT DOC IS THE SOURCE OF TRUTH — if
// this table disagrees with it, this table is the bug.
//
// Roles: admin = THE OWNER (full everywhere, incl. logins + org config),
// office/kantoormedewerker (the full operational app, but never logins or org
// config), technician/monteur (LIMITED field access), client/klant (LIMITED
// own-data / NONE).
//
// admin vs office is a horizontal split, not a rank: office does the work, the
// owner decides who gets in and how the company is configured. Before `office`
// existed, one `admin` flag guarded all 68 endpoints — the same bit that let you
// edit a material price also let you revoke another admin's login.
//
// NOTE: "limited" is coarse — it doesn't distinguish read vs write, nor HOW the
// access is delivered. See the per-cell notes in the doc. Two that matter here:
//   - customers/technician = "limited" means "customer info ON their own work
//     order" (name/address embedded in the werkbon payload) — NOT the Customers
//     list/section. The backend correctly keeps GET /customers admin+client only.
//   - reports/technician = "limited" means "own timesheet" (the /timesheet view),
//     NOT the company-wide reports.

export type UserRole = "admin" | "office" | "technician" | "client";

export type Section =
  | "dashboard"
  | "work_orders"
  | "planning"
  | "customers"
  | "employees"
  | "materials"
  | "reports"
  | "settings"
  | "users";

export type Access = "full" | "limited" | "none";

// Mirrors docs/roles-and-permissions.md cell-for-cell.
export const PERMISSION_MATRIX: Record<Section, Record<UserRole, Access>> = {
  dashboard:   { admin: "full", office: "full", technician: "limited", client: "limited" },
  work_orders: { admin: "full", office: "full", technician: "limited", client: "limited" },
  planning:    { admin: "full", office: "full", technician: "limited", client: "none" },
  customers:   { admin: "full", office: "full", technician: "limited", client: "limited" },
  // Office manages employee records fully, including delete — EXCEPT deleting
  // an employee who holds an admin login. Delete revokes the target's login
  // (employees/routes.ts), so the usual rule applies: never delete someone at
  // or above your own level.
  employees:   { admin: "full", office: "limited", technician: "none", client: "none" },
  materials:   { admin: "full", office: "full", technician: "limited", client: "none" },
  reports:     { admin: "full", office: "full", technician: "limited", client: "none" },
  // Office gets their own profile/security/notifications, but not the company
  // settings or the pre-job checklist template.
  settings:    { admin: "full", office: "limited", technician: "limited", client: "limited" },
  // Access / user provisioning — the OWNER only (not in the original spec table).
  users:       { admin: "full", office: "none", technician: "none", client: "none" },
};

export function accessFor(section: Section, role: UserRole): Access {
  return PERMISSION_MATRIX[section][role];
}

export function hasAnyAccess(section: Section, role: UserRole): boolean {
  return accessFor(section, role) !== "none";
}

// Whether the requesting role may see prices/financials.
//
// Admins and clients always see prices. Technicians NEVER do — this is an
// absolute rule from the client, not a configurable preference: the monteur
// sees the product and what to do, never what it costs or sells for. There is
// deliberately no org setting to switch this on.
export function canSeePrices(role: UserRole): boolean {
  return role !== "technician";
}

// Whether the requesting role may see COST price + margin (the difference
// between the selling price and what the material cost to buy).
//
// This is stricter than canSeePrices. The distinction the business draws is
// three-way on any billable line —
//   - technician (on the road): sees NO price at all (canSeePrices=false)
//   - client (opdrachtgever):    sees the SELLING price only
//   - THE OFFICE (admin+office):  sees the selling price AND the margin/cost
// Office is included deliberately: they price meerwerk and edit quoted lines, so
// hiding what a line cost makes that job impossible.
// Cost/margin must never leak into any client-facing surface (PDF, quote).
export function canSeeMargin(role: UserRole): boolean {
  return role === "admin" || role === "office";
}

// --- Role predicates -------------------------------------------------------
//
// The permission model lives HERE, not in scattered `role === "admin"` checks.
// Those comparisons stay valid TypeScript when a role is added, so they fail
// SILENTLY — a new role just quietly gets denied (or worse, falls into the
// technician branch). Every authorization decision should call one of these so
// adding the next role is a change in one file.

/** Anyone who works for the company — i.e. not an external customer login. */
export function isStaff(role: UserRole): boolean {
  return role !== "client";
}

/** Sees every project in the org, not just the ones they're assigned to. */
export function canSeeAllProjects(role: UserRole): boolean {
  return role === "admin" || role === "office";
}

/** May change WHAT WAS SOLD — quoted lines, zones, prices. The office's job. */
export function canEditQuoteScope(role: UserRole): boolean {
  return role === "admin" || role === "office";
}

/** Signs off meerwerk as the office (the first approval, before the client). */
export function canApproveAsOffice(role: UserRole): boolean {
  return role === "admin" || role === "office";
}

/**
 * May provision/revoke logins. THE OWNER ONLY — this is the line `office` must
 * never cross, and the reason the role exists.
 */
export function canManageAccounts(role: UserRole): boolean {
  return role === "admin";
}

/** May change company settings and org-wide templates. The owner only. */
export function canManageOrgSettings(role: UserRole): boolean {
  return role === "admin";
}
