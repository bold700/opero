// The Roles & Permissions matrix, encoded cell-for-cell from the authoritative
// spec at docs/roles-and-permissions.md. THAT DOC IS THE SOURCE OF TRUTH — if
// this table disagrees with it, this table is the bug.
//
// Roles: admin (FULL everywhere), technician/monteur (LIMITED field access),
// client/klant (LIMITED own-data / NONE).
//
// NOTE: "limited" is coarse — it doesn't distinguish read vs write, nor HOW the
// access is delivered. See the per-cell notes in the doc. Two that matter here:
//   - customers/technician = "limited" means "customer info ON their own work
//     order" (name/address embedded in the werkbon payload) — NOT the Customers
//     list/section. The backend correctly keeps GET /customers admin+client only.
//   - reports/technician = "limited" means "own timesheet" (the /timesheet view),
//     NOT the company-wide reports.

export type UserRole = "admin" | "technician" | "client";

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
  dashboard:   { admin: "full", technician: "limited", client: "limited" },
  work_orders: { admin: "full", technician: "limited", client: "limited" },
  planning:    { admin: "full", technician: "limited", client: "none" },
  customers:   { admin: "full", technician: "limited", client: "limited" },
  employees:   { admin: "full", technician: "none", client: "none" },
  materials:   { admin: "full", technician: "limited", client: "none" },
  reports:     { admin: "full", technician: "limited", client: "none" },
  settings:    { admin: "full", technician: "limited", client: "limited" },
  // Access / user provisioning — admin-only (not in the original spec table).
  users:       { admin: "full", technician: "none", client: "none" },
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
// This is stricter than canSeePrices: only ADMINS see margin. The distinction
// the business draws is three-way on any billable line —
//   - technician (on the road): sees NO price at all (canSeePrices=false)
//   - client (opdrachtgever):    sees the SELLING price only
//   - admin (management):        sees the selling price AND the margin/cost
// Cost/margin must never leak into any client-facing surface (PDF, quote).
export function canSeeMargin(role: UserRole): boolean {
  return role === "admin";
}
