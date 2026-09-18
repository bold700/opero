import type { UserRole } from "@opero/shared";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import WorkOrdersIcon from "@mui/icons-material/Assignment";
import ProjectsIcon from "@mui/icons-material/FolderSpecial";
import PlanningIcon from "@mui/icons-material/CalendarMonth";
import CustomersIcon from "@mui/icons-material/Groups";
import EmployeesIcon from "@mui/icons-material/Badge";
import MaterialsIcon from "@mui/icons-material/Inventory2";
import ReportsIcon from "@mui/icons-material/Assessment";
import TimesheetIcon from "@mui/icons-material/AccessTime";
import SettingsIcon from "@mui/icons-material/Settings";
import type { SvgIconComponent } from "@mui/icons-material";

// Single source of truth for the app's primary navigation. Routes are ENGLISH;
// `labelKey` is the i18n key (Dutch text comes from translations later).
// `roles` lists which user roles may see/access the route — mirrors the spec
// PERMISSION_MATRIX in @opero/shared.
export type NavItem = {
  path: string;
  /** i18n key for the destination label, e.g. "nav.dashboard". */
  labelKey: string;
  icon: SvgIconComponent;
  roles: UserRole[];
};

const ALL: UserRole[] = ["admin", "office", "foreman", "technician", "client"];
// The office: the owner + office staff. Everything operational is theirs; only
// login provisioning and org config stay with the owner alone.
const OFFICE: UserRole[] = ["admin", "office"];
// Field staff — on the tools. The foreman (meewerkend uitvoerder) additionally
// sees EVERYONE's werkbonnen and planning (backend scope), but shares the
// field-staff surface: no customers, no reports, and NEVER prices — the
// materials catalog is theirs to browse, with its price column dropped.
const FIELD: UserRole[] = ["foreman", "technician"];

export const NAV_ITEMS: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: DashboardIcon, roles: ALL },
  { path: "/work-orders", labelKey: "nav.workOrders", icon: WorkOrdersIcon, roles: ALL },
  // Projects — the grouping layer above werkbonnen. Managed by the office; the
  // foreman (projectleider on site) gets the same list and detail READ-ONLY and
  // without prices, so he sees which projects are running, not only his
  // werkbonnen. Technicians stay at the werkbon level.
  { path: "/projects", labelKey: "nav.projects", icon: ProjectsIcon, roles: [...OFFICE, "foreman"] },
  { path: "/planning", labelKey: "nav.planning", icon: PlanningIcon, roles: [...OFFICE, ...FIELD] },
  // Customers is the office's customer DATABASE — not for clients. A client's own
  // record is business data owned by the office (read-only to them); their
  // "manage own profile" is served by Settings (profile/security/notifications).
  { path: "/customers", labelKey: "nav.customers", icon: CustomersIcon, roles: OFFICE },
  { path: "/employees", labelKey: "nav.employees", icon: EmployeesIcon, roles: OFFICE },
  // Materials — the supplier parts catalog. Office sees prices; FIELD STAFF get
  // the same catalog with the price column removed entirely (canSeePrices is
  // false for technician AND foreman — an absolute rule, not a setting). Both
  // field roles get it: looking up a size on site is the same job whether you
  // are on the tools or running the crew.
  { path: "/materials", labelKey: "nav.materials", icon: MaterialsIcon, roles: [...OFFICE, ...FIELD] },
  { path: "/reports", labelKey: "nav.reports", icon: ReportsIcon, roles: OFFICE },
  // Own timesheet — field staff's "Reports = own hours" access (spec matrix).
  // The foreman works along on the tools, so he clocks hours like a technician.
  // Not for admins: they see company-wide hours in Reports, not a personal
  // timesheet (and an admin login usually has no linked employee record anyway).
  { path: "/timesheet", labelKey: "nav.timesheet", icon: TimesheetIcon, roles: FIELD },
  // No "Toegang" entry: login accounts are managed from the record they belong
  // to (Werknemers / Klanten), so a separate access screen listed the same
  // people twice.
  { path: "/settings", labelKey: "nav.settings", icon: SettingsIcon, roles: ALL },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessPath(path: string, role: UserRole): boolean {
  const item = NAV_ITEMS.find((i) => i.path === path);
  return item ? item.roles.includes(role) : true;
}
