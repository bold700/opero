import { createBrowserRouter } from "react-router-dom";
import { RequireAuth, RequireRouteAccess } from "../auth/guards";
import { AppShell } from "./AppShell";
import { Login } from "../features/auth/Login";
import { ForgotPassword } from "../features/auth/ForgotPassword";
import { ResetPassword } from "../features/auth/ResetPassword";
import { VerifyEmail } from "../features/auth/VerifyEmail";
import { Dashboard } from "../features/dashboard/Dashboard";
import { WorkOrders } from "../features/work-orders/WorkOrders";
import { WorkOrderDetail } from "../features/work-order-detail/WorkOrderDetail";
import { Customers } from "../features/customers/Customers";
import { Planning } from "../features/planning/Planning";
import { Employees } from "../features/employees/Employees";
import { Materials } from "../features/materials/Materials";
import { Reports } from "../features/reports/Reports";
import { Timesheet } from "../features/timesheet/Timesheet";
import { Users } from "../features/users/Users";
import { Settings } from "../features/settings/Settings";
import { Placeholder } from "../pages/Placeholder";

// Route tree. English paths, 1:1 with the backend modules. /login is standalone;
// every other route sits behind auth + the role-access guard, inside the AppShell.
export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/verify-email",
    element: <VerifyEmail />,
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
              { path: "/", element: <Dashboard /> },
              { path: "/work-orders", element: <WorkOrders /> },
              { path: "/work-orders/:id", element: <WorkOrderDetail /> },
              { path: "/planning", element: <Planning /> },
              { path: "/customers", element: <Customers /> },
              { path: "/employees", element: <Employees /> },
              { path: "/materials", element: <Materials /> },
              { path: "/reports", element: <Reports /> },
              { path: "/timesheet", element: <Timesheet /> },
              { path: "/users", element: <Users /> },
              { path: "/settings", element: <Settings /> },
            ],
          },
        ],
      },
    ],
  },
  // Anything unmatched → dashboard (which itself redirects to /login if needed).
  { path: "*", element: <Placeholder title="404" /> },
]);
