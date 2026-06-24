import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";

// A single labelled switch row (label + sub-text + toggle).
export function ToggleRow({ label, sub, on }: { label: string; sub: string; on: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.75 }}>
      <Box>
        <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </Box>
      <Switch defaultChecked={on} />
    </Box>
  );
}
