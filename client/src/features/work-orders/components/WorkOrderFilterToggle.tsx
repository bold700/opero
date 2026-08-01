import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FilterListIcon from "@mui/icons-material/FilterList";

// The Filters TRIGGER, split out from WorkOrderFilterBar (which keeps the
// collapsible panel). They're separate components because they no longer sit
// together: the trigger shares the status-chip row, pinned to its right edge,
// while the panel it opens expands full-width underneath. Keeping them in one
// component would have forced the panel into that row's layout.
export function WorkOrderFilterToggle({
  open,
  onToggle,
  activeCount,
  onClear,
}: {
  open: boolean;
  onToggle: () => void;
  /** Number of narrowing filters currently set — shown as a badge. */
  activeCount: number;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {/* Clear sits BEFORE the button so "Filters" stays the rightmost,
          fixed anchor — the row's edge shouldn't shift as filters come and go. */}
      {activeCount > 0 ? (
        <Button size="small" onClick={onClear}>
          {t("workOrders.filterBar.clear")}
        </Button>
      ) : null}
      <Button
        size="small"
        startIcon={<FilterListIcon />}
        onClick={onToggle}
        variant={open ? "contained" : "outlined"}
        disableElevation
      >
        {t("workOrders.filterBar.toggle")}
      </Button>
      {activeCount > 0 ? <Chip size="small" color="primary" label={activeCount} /> : null}
    </Box>
  );
}
