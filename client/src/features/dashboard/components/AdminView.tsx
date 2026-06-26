import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { KpiCard } from "./KpiCard";
import { TONE, STATUS_LABEL_KEY, euro } from "../constants";
import type { AdminDashboard } from "../api";

export function AdminView({ data }: { data: AdminDashboard }) {
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

      <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" }, alignItems: "stretch" }}>
        {/* Pipeline by status */}
        <Card sx={{ flex: 1, minWidth: 0, p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {t("dashboard.admin.pipelineTitle")}
          </Typography>
          {(["sales", "operations", "closing"] as const).map((s, i, arr) => (
            <Box key={s}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
                <Typography sx={{ fontWeight: 600 }}>{t(STATUS_LABEL_KEY[s])}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{data.byStatus[s] ?? 0}</Typography>
              </Box>
              {i < arr.length - 1 ? <Divider /> : null}
            </Box>
          ))}
        </Card>

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
