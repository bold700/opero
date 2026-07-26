import type { UserRole } from "@opero/shared";
import WorkOrderIcon from "@mui/icons-material/Assignment";
import ProjectIcon from "@mui/icons-material/FolderSpecial";
import CustomerIcon from "@mui/icons-material/Groups";
import EmployeeIcon from "@mui/icons-material/Badge";
import PlanningIcon from "@mui/icons-material/CalendarMonth";
import type { SvgIconComponent } from "@mui/icons-material";

// The quick-create menu (the "+" FAB). One entry per creatable thing. Each opens
// the feature route with `?create=1`; that page auto-opens its create dialog.
//
// `roles` here is about who may CREATE the thing, which is stricter than who may
// VIEW the section (see navigation.ts). All quick-create actions are admin-only:
// setting up a werkbon (customer + project) is an office task. Technicians are
// ASSIGNED werkbons and fill them in on the detail screen — they don't create.
export type QuickCreateAction = {
  /** stable id, also used for the i18n label key: quickCreate.<key>. */
  key: string;
  icon: SvgIconComponent;
  /** route to open; the target page reads ?create=1 and opens its dialog. */
  route: string;
  roles: UserRole[];
};

// Creating things is operational work: the owner and office staff both do it.
const OFFICE: UserRole[] = ["admin", "office"];

// Order matters — the headline action (new work order) comes first.
export const QUICK_CREATE_ACTIONS: QuickCreateAction[] = [
  { key: "workOrder", icon: WorkOrderIcon, route: "/work-orders?create=1", roles: OFFICE },
  // A project is the grouping above werkbonnen, so it sits next to it.
  { key: "project", icon: ProjectIcon, route: "/projects?create=1", roles: OFFICE },
  { key: "planning", icon: PlanningIcon, route: "/planning?create=1", roles: OFFICE },
  { key: "customer", icon: CustomerIcon, route: "/customers?create=1", roles: OFFICE },
  { key: "employee", icon: EmployeeIcon, route: "/employees?create=1", roles: OFFICE },
];

export function quickCreateActionsForRole(role: UserRole): QuickCreateAction[] {
  return QUICK_CREATE_ACTIONS.filter((a) => a.roles.includes(role));
}
