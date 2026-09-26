import { createBrowserRouter } from "react-router-dom";
import { RequireAuth, RequireRouteAccess } from "../auth/guards";
import { AppShell } from "./AppShell";
import { Placeholder } from "../pages/Placeholder";

// Route tree. English paths, 1:1 with the backend modules. /login is standalone;
// every other route sits behind auth + the role-access guard, inside the AppShell.
export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => ({ Component: (await import("../features/auth/Login")).Login }),
  },
  {
    path: "/forgot-password",
    lazy: async () => ({ Component: (await import("../features/auth/ForgotPassword")).ForgotPassword }),
  },
  {
    path: "/reset-password",
    lazy: async () => ({ Component: (await import("../features/auth/ResetPassword")).ResetPassword }),
  },
  {
    path: "/accept-invite",
    lazy: async () => ({ Component: (await import("../features/auth/AcceptInvite")).AcceptInvite }),
  },
  {
    path: "/verify-email",
    lazy: async () => ({ Component: (await import("../features/auth/VerifyEmail")).VerifyEmail }),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            element: <RequireRouteAccess />,
            children: [
              { path: "/", lazy: async () => ({ Component: (await import("../features/dashboard/Dashboard")).Dashboard }) },
              { path: "/work-orders", lazy: async () => ({ Component: (await import("../features/work-orders/WorkOrders")).WorkOrders }) },
              { path: "/work-orders/:id", lazy: async () => ({ Component: (await import("../features/work-order-detail/WorkOrderDetail")).WorkOrderDetail }) },
              { path: "/projects", lazy: async () => ({ Component: (await import("../features/projects/Projects")).Projects }) },
              { path: "/projects/:id", lazy: async () => ({ Component: (await import("../features/projects/ProjectDetail")).ProjectDetail }) },
              { path: "/planning", lazy: async () => ({ Component: (await import("../features/planning/Planning")).Planning }) },
              { path: "/customers", lazy: async () => ({ Component: (await import("../features/customers/Customers")).Customers }) },
              { path: "/customers/:id", lazy: async () => ({ Component: (await import("../features/customers/CustomerDetail")).CustomerDetail }) },
              { path: "/employees", lazy: async () => ({ Component: (await import("../features/employees/Employees")).Employees }) },
              { path: "/materials", lazy: async () => ({ Component: (await import("../features/materials/Materials")).Materials }) },
              { path: "/materials/:id", lazy: async () => ({ Component: (await import("../features/materials/MaterialDetail")).MaterialDetail }) },
              { path: "/reports", lazy: async () => ({ Component: (await import("../features/reports/Reports")).Reports }) },
              { path: "/timesheet", lazy: async () => ({ Component: (await import("../features/timesheet/Timesheet")).Timesheet }) },
              // No /users route: access is managed from Werknemers / Klanten.
              // The route had to go, not just the nav entry — canAccessPath
              // returns true for paths absent from NAV_ITEMS, so leaving it
              // would have opened it to every role.
              { path: "/settings", lazy: async () => ({ Component: (await import("../features/settings/Settings")).Settings }) },
            ],
          },
        ],
      },
    ],
  },
  // Anything unmatched → dashboard (which itself redirects to /login if needed).
  { path: "*", element: <Placeholder title="404" /> },
]);
