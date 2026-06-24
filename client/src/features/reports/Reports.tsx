import Box from "@mui/material/Box";
import { PageLayout } from "../../components/PageLayout";
import { ReportsActions } from "./components/ReportsActions";
import { ReportsKpis } from "./components/ReportsKpis";
import { WeeklyChart } from "./components/WeeklyChart";
import { RecentReports } from "./components/RecentReports";
import { TopMonteurs } from "./components/TopMonteurs";

// Reports (Rapporten) — M3 analytics page from the (orange) Figma: KPI cards,
// a weekly bar chart, recent reports list, top monteurs table. Demo data; wires
// to GET /api/reports.
export function Reports() {
  return (
    <PageLayout title="Rapporten" actions={<ReportsActions />}>
      <>
        {/* KPI cards */}
        <ReportsKpis />

        {/* Chart + recent reports */}
        <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" }, alignItems: "stretch" }}>
          <WeeklyChart />
          <RecentReports />
        </Box>

        {/* Top monteurs */}
        <TopMonteurs />
      </>
    </PageLayout>
  );
}
