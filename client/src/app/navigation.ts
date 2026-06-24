import type { UserRole } from "@opero/shared";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import WorkOrdersIcon from "@mui/icons-material/Assignment";
import PlanningIcon from "@mui/icons-material/CalendarMonth";
import CustomersIcon from "@mui/icons-material/Groups";
import EmployeesIcon from "@mui/icons-material/Badge";
import MaterialsIcon from "@mui/icons-material/Inventory2";
import ReportsIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import type { SvgIconComponent } from "@mui/icons-material";

// Single source of truth for the app's primary navigation. Routes are ENGLISH;
// `labelKey` is the i18n key (Dutch text comes from translations later).
// `roles` lists which user roles may see/access the route — mirrors the spec
// PERMISSION_MATRIX in @opero/shared.
export type NavItem = {
  path: string;
  labelKey: string;
  /** Fallback Dutch label until i18n is wired. */
  label: string;
  icon: SvgIconComponent;
  roles: UserRole[];
};

const ALL: UserRole[] = ["admin", "technician", "client"];

export const NAV_ITEMS: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", label: "Dashboard", icon: DashboardIcon, roles: ALL },
  { path: "/work-orders", labelKey: "nav.workOrders", label: "Werkbonnen", icon: WorkOrdersIcon, roles: ALL },
  { path: "/planning", labelKey: "nav.planning", label: "Planning", icon: PlanningIcon, roles: ["admin", "technician"] },
  { path: "/customers", labelKey: "nav.customers", label: "Klanten", icon: CustomersIcon, roles: ["admin", "client"] },
  { path: "/employees", labelKey: "nav.employees", label: "Werknemers", icon: EmployeesIcon, roles: ["admin"] },
  { path: "/materials", labelKey: "nav.materials", label: "Materialen", icon: MaterialsIcon, roles: ["admin", "technician"] },
  { path: "/reports", labelKey: "nav.reports", label: "Rapporten", icon: ReportsIcon, roles: ["admin", "technician"] },
  { path: "/settings", labelKey: "nav.settings", label: "Instellingen", icon: SettingsIcon, roles: ALL },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessPath(path: string, role: UserRole): boolean {
  const item = NAV_ITEMS.find((i) => i.path === path);
  return item ? item.roles.includes(role) : true;
}
