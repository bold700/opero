// Dutch resources, merged from per-feature namespace JSON files. One top-level
// key per namespace. Each feature owns its own file so parallel work never
// collides on a single giant JSON.
import common from "./nl/common.json";
import nav from "./nl/nav.json";
import auth from "./nl/auth.json";
import dashboard from "./nl/dashboard.json";
import customers from "./nl/customers.json";
import workOrders from "./nl/workOrders.json";
import workOrderDetail from "./nl/workOrderDetail.json";
import planning from "./nl/planning.json";
import employees from "./nl/employees.json";
import materials from "./nl/materials.json";
import reports from "./nl/reports.json";
import settings from "./nl/settings.json";
import activity from "./nl/activity.json";
import domain from "./nl/domain.json";

export const nl = {
  common,
  nav,
  auth,
  dashboard,
  customers,
  workOrders,
  workOrderDetail,
  planning,
  employees,
  materials,
  reports,
  settings,
  activity,
  domain,
};
