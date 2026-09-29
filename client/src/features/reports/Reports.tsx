import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../components/PageLayout";
import { OverviewGrid } from "../../components/OverviewGrid";
import { FilterSideSheet } from "../../components/FilterSideSheet";
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
import { SPACING } from "../../theme/tokens";

// Reports — company analytics for the office (admin). A period + focus filter
// drive live KPIs, a work-orders chart, top technicians, and recent work orders.
// Wired to GET /api/reports?from&to.
export function Reports() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>(() => monthPeriod());
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetcher = useCallback(() => getReports(period.from, period.to), [period]);
  const { data, loading, error } = useApi<ReportsData>(fetcher, [period.from, period.to]);
  const currentMonth = monthPeriod();
  const activeFilterCount =
    (filter === "all" ? 0 : 1) +
    (period.from === currentMonth.from && period.to === currentMonth.to ? 0 : 1);

  return (
    <PageLayout
      title={t("reports.title")}
      actions={
        <>
          <FilterSideSheet
            open={filtersOpen}
            onOpen={() => setFiltersOpen(true)}
            onClose={() => setFiltersOpen(false)}
            activeCount={activeFilterCount}
            onClear={() => {
              setPeriod(monthPeriod());
              setFilter("all");
            }}
          >
            <PeriodPicker period={period} onChange={setPeriod} />
            <FilterChips value={filter} onChange={setFilter} />
          </FilterSideSheet>
          <ReportsActions data={data} period={period} />
        </>
      }
    >
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
          <OverviewGrid>
            <Box sx={{ gridColumn: { xs: "1 / -1", lg: "span 3" }, minWidth: 0, display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
              <WeeklyChart chart={data.chart} />
              <TopEmployees employees={data.topEmployees} />
            </Box>
            <Box sx={{ gridColumn: { xs: "1 / -1", lg: "span 1" }, minWidth: 0 }}>
              <RecentWorkOrders workOrders={data.recentWorkOrders} />
            </Box>
          </OverviewGrid>
        </>
      )}
    </PageLayout>
  );
}
