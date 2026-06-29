import type { UserRole } from "@opero/shared";
import WorkOrderIcon from "@mui/icons-material/Assignment";
import CustomerIcon from "@mui/icons-material/Groups";
import EmployeeIcon from "@mui/icons-material/Badge";
import MaterialIcon from "@mui/icons-material/Inventory2";
import PlanningIcon from "@mui/icons-material/CalendarMonth";
import type { SvgIconComponent } from "@mui/icons-material";

// The quick-create menu (the "+" FAB). One entry per creatable thing. Each opens
// the feature route with `?create=1`; that page auto-opens its create dialog.
//
// `roles` here is about who may CREATE the thing, which is stricter than who may
// VIEW the section (see navigation.ts). E.g. a technician can create a work order
// but not a customer.
export type QuickCreateAction = {
  /** stable id, also used for the i18n label key: quickCreate.<key>. */
  key: string;
  icon: SvgIconComponent;
  /** route to open; the target page reads ?create=1 and opens its dialog. */
  route: string;
  roles: UserRole[];
};

// Order matters — the headline action (new work order) comes first.
export const QUICK_CREATE_ACTIONS: QuickCreateAction[] = [
  { key: "workOrder", icon: WorkOrderIcon, route: "/work-orders?create=1", roles: ["admin", "technician"] },
  { key: "planning", icon: PlanningIcon, route: "/planning?create=1", roles: ["admin"] },
  { key: "customer", icon: CustomerIcon, route: "/customers?create=1", roles: ["admin"] },
  { key: "employee", icon: EmployeeIcon, route: "/employees?create=1", roles: ["admin"] },
  { key: "material", icon: MaterialIcon, route: "/materials?create=1", roles: ["admin"] },
];

export function quickCreateActionsForRole(role: UserRole): QuickCreateAction[] {
  return QUICK_CREATE_ACTIONS.filter((a) => a.roles.includes(role));
}
