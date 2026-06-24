// The spec's Roles & Permissions matrix (work-order-app-spec.md §1), encoded
// literally so both the API (guards) and the web (nav/UI gating) read one source.
//
// Roles: admin (FULL everywhere), monteur (LIMITED), klant (LIMITED/NONE).

export type UserRole = "admin" | "monteur" | "klant";

export type Section =
  | "dashboard"
  | "work_orders"
  | "planning"
  | "customers"
  | "employees"
  | "materials"
  | "reports"
  | "settings";

export type Access = "full" | "limited" | "none";

// Mirrors the spec's Access Matrix table cell-for-cell.
export const PERMISSION_MATRIX: Record<Section, Record<UserRole, Access>> = {
  dashboard:   { admin: "full", monteur: "limited", klant: "limited" },
  work_orders: { admin: "full", monteur: "limited", klant: "limited" },
  planning:    { admin: "full", monteur: "limited", klant: "none" },
  customers:   { admin: "full", monteur: "limited", klant: "limited" },
  employees:   { admin: "full", monteur: "none", klant: "none" },
  materials:   { admin: "full", monteur: "limited", klant: "none" },
  reports:     { admin: "full", monteur: "limited", klant: "none" },
  settings:    { admin: "full", monteur: "limited", klant: "limited" },
};

export function accessFor(section: Section, role: UserRole): Access {
  return PERMISSION_MATRIX[section][role];
}

export function hasAnyAccess(section: Section, role: UserRole): boolean {
  return accessFor(section, role) !== "none";
}

// Monteurs must not see prices/financials (ported from the store's canSeePrices).
export function canSeePrices(role: UserRole): boolean {
  return role !== "monteur";
}
