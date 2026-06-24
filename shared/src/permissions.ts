// The spec's Roles & Permissions matrix (work-order-app-spec.md §1), encoded
// literally so both the API (guards) and the web (nav/UI gating) read one source.
//
// Roles: admin (FULL everywhere), technician (LIMITED), client (LIMITED/NONE).

export type UserRole = "admin" | "technician" | "client";

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
  dashboard:   { admin: "full", technician: "limited", client: "limited" },
  work_orders: { admin: "full", technician: "limited", client: "limited" },
  planning:    { admin: "full", technician: "limited", client: "none" },
  customers:   { admin: "full", technician: "limited", client: "limited" },
  employees:   { admin: "full", technician: "none", client: "none" },
  materials:   { admin: "full", technician: "limited", client: "none" },
  reports:     { admin: "full", technician: "limited", client: "none" },
  settings:    { admin: "full", technician: "limited", client: "limited" },
};

export function accessFor(section: Section, role: UserRole): Access {
  return PERMISSION_MATRIX[section][role];
}

export function hasAnyAccess(section: Section, role: UserRole): boolean {
  return accessFor(section, role) !== "none";
}

// Technicians must not see prices/financials (ported from the store's canSeePrices).
export function canSeePrices(role: UserRole): boolean {
  return role !== "technician";
}
