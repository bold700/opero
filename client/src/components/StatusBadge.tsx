import Box from "@mui/material/Box";
import { RADIUS, type StatusTone } from "../theme/tokens";

// Small rounded status pill. One implementation, reused everywhere a colored
// label is shown (work order status, stock status, employee status, type, …).
export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1.25,
        py: 0.5,
        borderRadius: `${RADIUS.control}px`,
        bgcolor: tone.bg,
        color: tone.fg,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}
