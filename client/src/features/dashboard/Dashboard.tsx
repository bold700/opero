import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { useApi } from "../../lib/api/useApi";
import { useState } from "react";
import { getDashboard, type DashboardData, type SalesPeriod } from "./api";
import { DashboardActions } from "./components/DashboardActions";
import { AdminView } from "./components/AdminView";
import { TechnicianView } from "./components/TechnicianView";
import { ClientView } from "./components/ClientView";

export function Dashboard() {
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("all");
  const { data, loading, error } = useApi<DashboardData>(() => getDashboard(salesPeriod), [salesPeriod]);

  return (
    <PageLayout title="Dashboard" actions={<DashboardActions />}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : data ? (
        data.role === "technician" || data.role === "foreman" ? (
          // The foreman gets the same money-free view as the technician; his
          // payload is simply scoped to every project instead of assigned ones.
          <TechnicianView data={data} />
        ) : data.role === "client" ? (
          <ClientView data={data} />
        ) : (
          // `data.role` is the VIEW the server chose, not the user's role —
          // office staff get the admin payload. Defaulting here rather than
          // matching "admin" exactly means a new role can never render a blank
          // page.
          <AdminView data={data} salesPeriod={salesPeriod} onSalesPeriodChange={setSalesPeriod} />
        )
      ) : null}
    </PageLayout>
  );
}
