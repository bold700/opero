import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { StatusBadge } from "../../../components/StatusBadge";
import { STATUS_TONES, SPACING } from "../../../theme/tokens";
import { humanize } from "../../../lib/labels";
import type { PlanningEntry } from "../api";

// Right-side details panel for the selected calendar entry, with actions
// (admin only): open the work order, reschedule, remove from planning.
export function DetailsPanel({
  entry,
  canManage,
  busy,
  onClose,
  onOpenWorkOrder,
  onEdit,
  onRemove,
}: {
  entry: PlanningEntry;
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onOpenWorkOrder: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const time =
    entry.startTime && entry.endTime
      ? `${entry.startTime} — ${entry.endTime}`
      : entry.date;

  return (
    <Box sx={{ width: 320, flexShrink: 0, p: SPACING.pagePadding, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t("planning.details")}
        </Typography>
        <IconButton size="small" aria-label={t("common.actions.close")} onClick={onClose} sx={{ mr: -1 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {entry.customerName}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {entry.projectNumber}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
          <PlaceOutlinedIcon fontSize="small" />
          <Typography variant="body2" sx={{ color: "text.primary" }}>
            {entry.address}
            {entry.city ? `, ${entry.city}` : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
          <AccessTimeIcon fontSize="small" />
          <Typography variant="body2" sx={{ color: "text.primary" }}>{time}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
          <PersonOutlineIcon fontSize="small" />
          <Typography variant="body2" sx={{ color: "text.primary" }}>
            {entry.teamLeaderName ?? t("planning.schedule.unassigned")}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <StatusBadge
          label={t(`planning.status.${entry.status}`, { defaultValue: humanize(entry.status) })}
          tone={STATUS_TONES.open}
        />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={onOpenWorkOrder}>
          {t("planning.openWorkOrder")}
        </Button>
        {canManage ? (
          <>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={onEdit} disabled={busy}>
              {t("common.actions.edit")}
            </Button>
            <Button variant="text" color="error" startIcon={<DeleteOutlineIcon />} onClick={onRemove} disabled={busy}>
              {t("planning.removeFromPlanning")}
            </Button>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
