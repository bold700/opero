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
    // A GRID, not a flex row: the old `flex: 1 1 45%` was overridden by
    // `minWidth: 180`, so on a phone two cards + the gap exceeded the viewport
    // and every card wrapped onto its own line — four full-width cards pushing
    // the actual list a screen down. Grid columns divide the available width
    // instead of fighting a min-width, so all 4 fit in one row at every size.
    <Box
      sx={{
        display: "grid",
        gap: { xs: 1, sm: 2.5 },
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      }}
    >
      {kpis.map((k) => (
        // Tighter padding and a smaller number on mobile — at 4-up on a phone
        // the card is under a quarter of its designed width.
        <Card key={k.label} sx={{ p: { xs: 1, sm: 2.5 } }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 500, mb: 0.5, fontSize: { xs: 11, sm: 14 } }}
          >
            {k.label}
          </Typography>
          <Typography
            sx={{ fontSize: { xs: 18, sm: 28 }, fontWeight: 700, color: k.tone, lineHeight: 1 }}
          >
            {k.value}
          </Typography>
        </Card>
      ))}
    </Box>
  );
}
