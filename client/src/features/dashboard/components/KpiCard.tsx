import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";

// A single dashboard KPI: label, big number, optional sub-line.
export function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: string;
}) {
  return (
    <Card
      sx={{
        width: "100%",
        height: "100%",
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 700, color: tone, lineHeight: 1 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      ) : null}
    </Card>
  );
}
