import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";

// A single labelled switch row (label + sub-text + toggle). Controlled: the
// parent owns the value and gets notified of changes.
export function ToggleRow({
  label,
  sub,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.75 }}>
      <Box>
        <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </Box>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </Box>
  );
}
