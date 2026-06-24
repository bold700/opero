import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { LAVENDER, RADIUS } from "../../../theme/tokens";
import { KPIS } from "../constants";

// Row of icon KPI cards at the top of the reports page.
export function ReportsKpis() {
  return (
    <Box sx={{ display: "flex", gap: 2.5, flexWrap: { xs: "wrap", lg: "nowrap" } }}>
      {KPIS.map((k) => {
        const Icon = k.icon;
        return (
          <Card key={k.label} sx={{ flex: { xs: "1 1 45%", lg: "1 1 0" }, minWidth: 180, p: 2.5, display: "flex", gap: 2, alignItems: "center" }}>
            <Box sx={{ width: 44, height: 44, borderRadius: `${RADIUS.control}px`, bgcolor: LAVENDER, color: "primary.main", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {k.label}
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                {k.value}
              </Typography>
            </Box>
          </Card>
        );
      })}
    </Box>
  );
}
