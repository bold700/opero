import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";

// Weekly work-orders bar chart.
export function WeeklyChart({ chart }: { chart: { week: string; value: number }[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...chart.map((c) => c.value));
  return (
    <Card sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
        {t("reports.weeklyChart.title")}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 240, gap: 2 }}>
        {chart.map((c) => (
          <Box key={c.week} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, height: "100%", justifyContent: "flex-end" }}>
            <Box
              sx={{
                width: "60%",
                maxWidth: 56,
                height: `${(c.value / max) * 100}%`,
                minHeight: c.value > 0 ? 4 : 0,
                bgcolor: "primary.main",
                borderRadius: "8px 8px 0 0",
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {c.week}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}
