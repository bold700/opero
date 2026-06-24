import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { Card } from "../../../components/Card";
import { KpiCard } from "./KpiCard";
import { TONE, STATUS_LABEL, euro } from "../constants";
import type { AdminDashboard } from "../api";

export function AdminView({ data }: { data: AdminDashboard }) {
  const kpis = [
    { label: "Projecten totaal", value: data.kpis.totalProjects, tone: TONE.primary },
    { label: "Ingepland deze week", value: data.kpis.plannedThisWeek, tone: TONE.info },
    {
      label: "Spoed / geblokkeerd",
      value: data.urgentCount + data.blockedCount,
      tone: TONE.danger,
      sub: `${data.urgentCount} urgent · ${data.blockedCount} geblokkeerd`,
    },
    { label: "Klaar voor facturatie", value: data.kpis.readyToInvoice, tone: TONE.success },
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
            Projecten per status
          </Typography>
          {(["sales", "operations", "closing"] as const).map((s, i, arr) => (
            <Box key={s}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
                <Typography sx={{ fontWeight: 600 }}>{STATUS_LABEL[s]}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{data.byStatus[s] ?? 0}</Typography>
              </Box>
              {i < arr.length - 1 ? <Divider /> : null}
            </Box>
          ))}
        </Card>

        {/* Financials */}
        <Card sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0, p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Financieel
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
            <Typography color="text.secondary">Pipeline waarde</Typography>
            <Typography sx={{ fontWeight: 700 }}>{euro(data.pipelineValue)}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
            <Typography color="text.secondary">Openstaande facturen</Typography>
            <Typography sx={{ fontWeight: 700 }}>{data.openInvoices}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.5 }}>
            <Typography color="text.secondary">Activiteit (7 dagen)</Typography>
            <Typography sx={{ fontWeight: 700 }}>{data.kpis.recentActivity}</Typography>
          </Box>
        </Card>
      </Box>
    </>
  );
}
