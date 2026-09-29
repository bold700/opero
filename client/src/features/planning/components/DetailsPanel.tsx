import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { BottomSheet } from "../../../components/BottomSheet";
import { StatusBadge } from "../../../components/StatusBadge";
import { FILTER_SHEET_WIDTH, STATUS_TONES, SPACING, TAP_TARGET } from "../../../theme/tokens";
import { humanize } from "../../../lib/labels";
import type { PlanningEntry } from "../api";

// The panel body — shared between the desktop fixed side panel and the mobile
// bottom drawer, so both show identical content + actions.
function DetailsBody({
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
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t("planning.details")}
        </Typography>
        <IconButton
          size="small"
          aria-label={t("common.actions.close")}
          onClick={onClose}
          sx={{ mr: -1, minWidth: { xs: TAP_TARGET, md: 0 }, minHeight: { xs: TAP_TARGET, md: 0 } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {entry.customerName}
      </Typography>
      {entry.workOrderTitle ? (
        <Typography variant="body2">{entry.workOrderTitle}</Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {entry.projectNumber}
        {entry.projectName ? ` · ${entry.projectName}` : ""}
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
        {entry.installerNames.length > 0 ? (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "text.secondary" }}>
            <PersonOutlineIcon fontSize="small" />
            <Typography variant="body2" sx={{ color: "text.primary" }}>
              {entry.installerNames.join(", ")}
            </Typography>
          </Box>
        ) : null}
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
    </>
  );
}

// Details for the selected calendar entry, with admin actions. Desktop uses the
// same right-side sheet pattern as filters; phones use a bottom sheet.
export function DetailsPanel(props: {
  entry: PlanningEntry;
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onOpenWorkOrder: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (isMobile) {
    return (
      <BottomSheet
        open
        onClose={props.onClose}
        title={t("planning.details")}
        scrollableContent
        maxHeight="85dvh"
      >
        {/* The body scrolls internally on small phones (the sheet is capped);
            the sheet itself drags from the handle. */}
        <Box
          sx={{
            overflowY: "auto",
            minHeight: 0,
            overscrollBehavior: "contain",
            p: SPACING.pagePadding,
            pt: 1.5,
          }}
        >
          <DetailsBody {...props} />
        </Box>
      </BottomSheet>
    );
  }

  return (
    <Drawer
      anchor="right"
      open
      onClose={props.onClose}
      slotProps={{
        paper: {
          sx: {
            width: FILTER_SHEET_WIDTH,
            maxWidth: "100vw",
            p: SPACING.pagePadding,
          },
        },
      }}
    >
      <DetailsBody {...props} />
    </Drawer>
  );
}
