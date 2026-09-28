import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { KpiCard } from "./KpiCard";
import { WorkOrderLifecycleCard } from "./WorkOrderLifecycleCard";
import { TONE, euro } from "../constants";
import { FilterSelect } from "../../../components/FilterSelect";
import type { AdminDashboard, SalesPeriod } from "../api";

export function AdminView({
  data,
  salesPeriod,
  onSalesPeriodChange,
}: {
  data: AdminDashboard;
  salesPeriod: SalesPeriod;
  onSalesPeriodChange: (p: SalesPeriod) => void;
}) {
  const { t } = useTranslation();
  const kpis = [
    { label: t("dashboard.admin.kpis.totalProjects"), value: data.kpis.totalProjects, tone: TONE.primary },
    { label: t("dashboard.admin.kpis.plannedThisWeek"), value: data.kpis.plannedThisWeek, tone: TONE.info },
    {
      label: t("dashboard.admin.kpis.urgentBlocked"),
      value: data.urgentCount + data.blockedCount,
      tone: TONE.danger,
      sub: t("dashboard.admin.kpis.urgentBlockedSub", { urgent: data.urgentCount, blocked: data.blockedCount }),
    },
    { label: t("dashboard.admin.kpis.readyToInvoice"), value: data.kpis.readyToInvoice, tone: TONE.success },
  ];

  return (
    <>
      <Box sx={{ display: "flex", gap: 2.5, flexWrap: { xs: "wrap", lg: "nowrap" } }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" }, alignItems: { xs: "stretch", lg: "flex-start" } }}>
        {/* Work orders grouped by their automatic lifecycle phase. */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.5 }}>
          <WorkOrderLifecycleCard counts={data.byWorkOrderStatus} />

          {/* Sales & usage — what was sold on werkbon lines, what it cost,
              what remains, and the metres actually laid. */}
          <Card sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t("dashboard.admin.salesTitle")}
              </Typography>
              <FilterSelect
                value={salesPeriod}
                onChange={(v) => onSalesPeriodChange(v as SalesPeriod)}
                ariaLabel={t("dashboard.admin.period.label")}
                minWidth={140}
                options={(["all", "month", "year", "30d"] as const).map((p) => ({
                  value: p,
                  label: t(`dashboard.admin.period.${p}`),
                }))}
              />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
              <Typography color="text.secondary">{t("dashboard.admin.salesSold")}</Typography>
              <Typography sx={{ fontWeight: 700 }}>{euro(data.sales.sold)}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
              <Typography color="text.secondary">{t("dashboard.admin.salesCost")}</Typography>
              <Typography sx={{ fontWeight: 700 }}>{euro(data.sales.cost)}</Typography>
            </Box>
            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
              <Typography color="text.secondary">{t("dashboard.admin.salesProfit")}</Typography>
              <Typography sx={{ fontWeight: 700, color: data.sales.profit >= 0 ? "success.main" : "error.main" }}>
                {euro(data.sales.profit)}
              </Typography>
            </Box>
            <Divider />
            <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
              <Typography color="text.secondary">{t("dashboard.admin.metersLaid")}</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {t("dashboard.admin.metersValue", { meters: Math.round(data.sales.metersLaid) })}
              </Typography>
            </Box>
          </Card>
        </Box>

        {/* Financials */}
        <Card sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0, p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {t("dashboard.admin.financialTitle")}
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
            <Typography color="text.secondary">{t("dashboard.admin.pipelineValue")}</Typography>
            <Typography sx={{ fontWeight: 700 }}>{euro(data.pipelineValue)}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
            <Typography color="text.secondary">{t("dashboard.admin.openInvoices")}</Typography>
            <Typography sx={{ fontWeight: 700 }}>{data.openInvoices}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
            <Typography color="text.secondary">{t("dashboard.admin.recentActivity")}</Typography>
            <Typography sx={{ fontWeight: 700 }}>{data.kpis.recentActivity}</Typography>
          </Box>
        </Card>
      </Box>
    </>
  );
}
