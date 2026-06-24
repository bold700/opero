import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { KPIS } from "../constants";

// Row of KPI cards above the materials table.
export function MaterialsKpis() {
  return (
    <Box sx={{ display: "flex", gap: 2.5, flexWrap: { xs: "wrap", lg: "nowrap" } }}>
      {KPIS.map((k) => (
        <Card key={k.label} sx={{ flex: { xs: "1 1 45%", lg: "1 1 0" }, minWidth: 180, p: 2.5 }}>
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
