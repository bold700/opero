import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../components/PageLayout";
import { useApi } from "../../lib/api/useApi";
import { getReports, type ReportsData, type ReportFilter } from "./api";
import { monthPeriod, type Period } from "./constants";
import { ReportsActions } from "./components/ReportsActions";
import { ReportsKpis } from "./components/ReportsKpis";
import { WeeklyChart } from "./components/WeeklyChart";
import { TopEmployees } from "./components/TopEmployees";
import { RecentWorkOrders } from "./components/RecentWorkOrders";
import { PeriodPicker } from "./components/PeriodPicker";
import { FilterChips } from "./components/FilterChips";

// Reports — company analytics for the office (admin). A period + focus filter
// drive live KPIs, a work-orders chart, top technicians, and recent work orders.
// Wired to GET /api/reports?from&to.
export function Reports() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>(() => monthPeriod());
  const [filter, setFilter] = useState<ReportFilter>("all");

  const fetcher = useCallback(() => getReports(period.from, period.to), [period]);
  const { data, loading, error } = useApi<ReportsData>(fetcher, [period.from, period.to]);

  const controls = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        width: { xs: "100%", md: "auto" },
      }}
    >
      <PeriodPicker period={period} onChange={setPeriod} />
      <ReportsActions data={data} period={period} />
    </Box>
  );

  return (
    <PageLayout title={t("reports.title")} actions={controls}>
      <FilterChips value={filter} onChange={setFilter} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error || !data ? (
        <Alert severity="error">{error ?? t("reports.loadError")}</Alert>
      ) : (
        <>
          <ReportsKpis kpis={data.kpis} filter={filter} />

          {/* Left column: chart + top technicians stacked. Right column: recent
              work orders alongside both — so nothing spans full width. */}
          <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" }, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.5 }}>
              <WeeklyChart chart={data.chart} />
              <TopEmployees employees={data.topEmployees} />
            </Box>
            <RecentWorkOrders workOrders={data.recentWorkOrders} />
          </Box>
        </>
      )}
    </PageLayout>
  );
}
