import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../components/PageLayout";
import { useApi } from "../../lib/api/useApi";
import { getReports, type ReportsData } from "./api";
import { ReportsActions } from "./components/ReportsActions";
import { ReportsKpis } from "./components/ReportsKpis";
import { WeeklyChart } from "./components/WeeklyChart";
import { RecentReports } from "./components/RecentReports";
import { TopEmployees } from "./components/TopEmployees";

// Reports (Rapporten) — M3 analytics page: KPI cards, weekly bar chart, recent
// reports list, top employees. Wired to GET /api/reports.
export function Reports() {
  const { t } = useTranslation();
  const { data, loading, error } = useApi<ReportsData>(getReports);

  if (loading) {
    return (
      <PageLayout title={t("reports.title")} actions={<ReportsActions />}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }
  if (error || !data) {
    return (
      <PageLayout title={t("reports.title")} actions={<ReportsActions />}>
        <Alert severity="error">{error ?? t("reports.loadError")}</Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t("reports.title")} actions={<ReportsActions data={data} />}>
      <ReportsKpis kpis={data.kpis} />

      {/* Chart + recent reports */}
      <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" }, alignItems: "stretch" }}>
        <WeeklyChart chart={data.chart} />
        <RecentReports reports={data.recentReports} />
      </Box>

      {/* Top employees */}
      <TopEmployees employees={data.topEmployees} />
    </PageLayout>
  );
}
