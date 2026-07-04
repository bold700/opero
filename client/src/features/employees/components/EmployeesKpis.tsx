import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import type { EmployeeCounts } from "../api";

// Row of KPI cards above the employees table. Numbers come from the server's
// whole-set counts (via meta.counts), not a client-side scan of the rows.
export function EmployeesKpis({ counts }: { counts: EmployeeCounts }) {
  const { t } = useTranslation();

  const kpis = [
    { label: t("employees.kpis.total"), value: counts.total, tone: "#1D1B20" },
    { label: t("employees.kpis.technicians"), value: counts.technicians, tone: "#1D1B20" },
    { label: t("employees.kpis.office"), value: counts.office, tone: "#1D1B20" },
    { label: t("employees.kpis.active"), value: counts.active, tone: "#1E8E5A" },
  ];

  return (
    <Box sx={{ display: "flex", gap: 2.5, flexWrap: { xs: "wrap", lg: "nowrap" } }}>
      {kpis.map((k) => (
        <Card
          key={k.label}
          sx={{ flex: { xs: "1 1 45%", lg: "1 1 0" }, minWidth: 180, p: 2.5 }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
            {k.label}
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: k.tone, lineHeight: 1 }}>
            {k.value}
          </Typography>
        </Card>
      ))}
    </Box>
  );
}
