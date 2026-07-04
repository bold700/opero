import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { TAP_TARGET } from "../theme/tokens";

// The standard "New X" action for a page's top bar. On desktop it's a labeled
// contained button ("+ New customer"); on phones it collapses to a compact
// filled icon button (just "+") so long Dutch labels don't blow up the header or
// push the search field onto its own row. Used by every list screen's Actions so
// the headers are consistent.
export function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"));

  if (compact) {
    return (
      <IconButton
        color="primary"
        aria-label={label}
        onClick={onClick}
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          width: TAP_TARGET,
          height: TAP_TARGET,
          flexShrink: 0,
          "&:hover": { bgcolor: "primary.dark" },
        }}
      >
        <AddIcon />
      </IconButton>
    );
  }

  return (
    <Button variant="contained" startIcon={<AddIcon />} onClick={onClick}>
      {label}
    </Button>
  );
}
