import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { OverviewGrid } from "../../../components/OverviewGrid";
import { LAVENDER, RADIUS } from "../../../theme/tokens";
import type { ReportsData, ReportFilter } from "../api";
import { KPI_META, euro, formatHours } from "../constants";

// Which KPI card the focus filter highlights.
const FILTER_TO_KPI: Record<ReportFilter, string | null> = {
  all: null,
  workOrders: "workOrders",
  hours: "hours",
  materials: "materialCosts",
};

// Row of icon KPI cards at the top of the reports page. The active focus filter
// highlights the matching card.
export function ReportsKpis({ kpis, filter = "all" }: { kpis: ReportsData["kpis"]; filter?: ReportFilter }) {
  const { t, i18n } = useTranslation();
  const highlighted = FILTER_TO_KPI[filter];
  const display: Record<string, string> = {
    workOrders: String(kpis.workOrders),
    hours: formatHours(kpis.hours, i18n.language),
    revenue: euro(kpis.revenue),
    materialCosts: euro(kpis.materialCosts),
  };
  return (
    <OverviewGrid>
      {KPI_META.map((k) => {
        const active = highlighted === k.key;
        const Icon = k.icon;
        return (
          <Card
            key={k.key}
            sx={{
              width: "100%",
              height: "100%",
              p: 2.5,
              display: "flex",
              gap: 2,
              alignItems: "center",
              border: "2px solid",
              borderColor: active ? "primary.main" : "transparent",
              transition: "border-color .15s",
            }}
          >
            <Box sx={{ width: 44, height: 44, borderRadius: `${RADIUS.control}px`, bgcolor: LAVENDER, color: "primary.main", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {t(k.labelKey)}
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                {display[k.key]}
              </Typography>
            </Box>
          </Card>
        );
      })}
    </OverviewGrid>
  );
}
