import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useAuth } from "../../auth/AuthContext";
import { PageLayout } from "../../components/PageLayout";
import { useApi } from "../../lib/api/useApi";
import { getDashboard, type DashboardData } from "./api";
import { DashboardActions } from "./components/DashboardActions";
import { AdminView } from "./components/AdminView";
import { TechnicianView } from "./components/TechnicianView";
import { ClientView } from "./components/ClientView";

export function Dashboard() {
  const { user } = useAuth();
  const firstName = (user?.name ?? "").split(" ")[0];
  const { data, loading, error } = useApi<DashboardData>(getDashboard);

  return (
    <PageLayout title="Dashboard" actions={<DashboardActions />}>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Welkom{firstName ? `, ${firstName}` : ""}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : data?.role === "admin" ? (
        <AdminView data={data} />
      ) : data?.role === "technician" ? (
        <TechnicianView data={data} />
      ) : data?.role === "client" ? (
        <ClientView data={data} />
      ) : null}
    </PageLayout>
  );
}
