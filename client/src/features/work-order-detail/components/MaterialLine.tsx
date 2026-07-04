import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { euro } from "../constants";
import type { WorkOrderMaterial } from "../api";

// One material line under a task: checkbox (on-site/done), name + qty, optional
// price (hidden for technicians), delete.
export function MaterialLine({
  material,
  canWrite,
  showPrices,
  busy,
  onToggle,
  onDelete,
}: {
  material: WorkOrderMaterial;
  canWrite: boolean;
  showPrices: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const m = material;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.25 }}>
      <Checkbox
        checked={m.done}
        onChange={onToggle}
        disabled={!canWrite || busy}
        size="small"
        sx={{ p: { xs: 1.25, md: 0.5 } }}
      />
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          minWidth: 0,
          color: m.done ? "text.secondary" : "text.primary",
        }}
      >
        {m.name}
        <Box component="span" sx={{ color: "text.secondary" }}>
          {" "}
          · {m.quantity} {m.unit}
          {showPrices && m.unitPrice != null
            ? ` · ${euro(m.quantity * m.unitPrice)}`
            : ""}
        </Box>
      </Typography>
      {canWrite ? (
        <IconButton
          size="small"
          aria-label={t("workOrderDetail.material.delete")}
          onClick={onDelete}
          disabled={busy}
          sx={{ p: { xs: 1.25, md: 0.5 } }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Box>
  );
}
