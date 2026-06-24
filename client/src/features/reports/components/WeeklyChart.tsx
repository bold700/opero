import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { CHART, CHART_MAX } from "../constants";

// Weekly work-orders bar chart.
export function WeeklyChart() {
  return (
    <Card sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
        Werkbonnen per week
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 240, gap: 2 }}>
        {CHART.map((c) => (
          <Box key={c.week} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, height: "100%", justifyContent: "flex-end" }}>
            <Box
              sx={{
                width: "60%",
                maxWidth: 56,
                height: `${(c.value / CHART_MAX) * 100}%`,
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
