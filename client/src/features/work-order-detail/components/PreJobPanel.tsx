import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Card } from "../../../components/Card";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { HAIRLINE } from "../../../theme/tokens";
import type { WorkOrder } from "../api";

// Pre-job check — the dispatch gate. The checklist is PER WERKBON: snapshotted
// from the org template at creation and editable HERE by the office (admin) —
// tick, rename, add a one-off item, remove, reorder. The photo requirement is a
// per-werkbon toggle (default off); a photo only gates dispatch when it's on.
// Once dispatched, the whole section is read-only.
export function PreJobPanel({
  workOrder,
  isAdmin,
  busy,
  onToggleCheck,
  onRenameItem,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onSetPhotoRequired,
  onUploadPhoto,
  onDeletePhoto,
  onDispatch,
}: {
  workOrder: WorkOrder;
  isAdmin: boolean;
  busy: boolean;
  onToggleCheck: (itemId: string, done: boolean) => void;
  onRenameItem: (itemId: string, label: string) => void;
  onAddItem: (label: string) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (orderedIds: string[]) => void;
  onSetPhotoRequired: (required: boolean) => void;
  onUploadPhoto: (file: File) => void;
  onDeletePhoto: (key: string) => void;
  onDispatch: () => void;
}) {
  const { t } = useTranslation();
  const [newLabel, setNewLabel] = useState("");
  const dispatched = Boolean(workOrder.dispatchedAt);
  const editable = isAdmin && !dispatched;
  const items = [...workOrder.prejobItems].sort((a, b) => a.ordinal - b.ordinal);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onMoveItem(next.map((i) => i.id));
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    onAddItem(label);
    setNewLabel("");
  };

  return (
    <Card noPadding>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.prejob.title")}
        </Typography>
        {dispatched ? (
          <Chip
            size="small"
            color="success"
            icon={<CheckCircleOutlineIcon />}
            label={t("workOrderDetail.prejob.dispatched")}
          />
        ) : null}
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Typography variant="body2" color="text.secondary">
          {t("workOrderDetail.prejob.description")}
        </Typography>

        {/* Checklist — editable inline for admin (pre-dispatch). */}
        <Box>
          {items.map((item, i) => (
            <Box key={item.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Checkbox
                checked={item.done}
                disabled={!editable || busy}
                onChange={(e) => onToggleCheck(item.id, e.target.checked)}
                sx={{ p: { xs: 1.25, md: 1 } }}
              />
              {editable ? (
                <>
                  <TextField
                    variant="standard"
                    defaultValue={item.label}
                    key={`${item.id}-${item.label}`}
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== item.label) onRenameItem(item.id, v);
                    }}
                    sx={{ flex: 1 }}
                  />
                  <IconButton size="small" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t("workOrderDetail.prejob.moveUp")}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={t("workOrderDetail.prejob.moveDown")}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" disabled={busy} onClick={() => onRemoveItem(item.id)} aria-label={t("workOrderDetail.prejob.removeItem")}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <Typography variant="body2" sx={{ flex: 1, py: 1 }}>
                  {item.label}
                </Typography>
              )}
            </Box>
          ))}

          {editable ? (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
              <TextField
                size="small"
                placeholder={t("workOrderDetail.prejob.addItemPlaceholder")}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                }}
                disabled={busy}
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" startIcon={<AddIcon />} onClick={add} disabled={busy || !newLabel.trim()}>
                {t("workOrderDetail.prejob.addItem")}
              </Button>
            </Box>
          ) : null}
        </Box>

        {/* Per-werkbon photo requirement toggle (admin). */}
        {editable ? (
          <FormControlLabel
            control={
              <Switch
                checked={workOrder.prejobPhotoRequired}
                onChange={(e) => onSetPhotoRequired(e.target.checked)}
                disabled={busy}
              />
            }
            label={t("workOrderDetail.prejob.photoRequired")}
          />
        ) : null}

        {/* Photos — only shown when this werkbon REQUIRES a photo (the toggle
            above). Still shown if photos already exist, so turning the toggle
            off never silently hides ones already attached. */}
        {workOrder.prejobPhotoRequired || workOrder.prejobPhotos.length > 0 ? (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              {t("workOrderDetail.prejob.photos")}
            </Typography>
            <PhotoGrid
              photos={workOrder.prejobPhotos}
              canEdit={editable}
              busy={busy}
              onAdd={onUploadPhoto}
              onRemove={onDeletePhoto}
            />
          </Box>
        ) : null}

        {/* Dispatch action (admin) */}
        {isAdmin && !dispatched ? (
          <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
            <Button
              variant="contained"
              startIcon={<LocalShippingOutlinedIcon />}
              disabled={busy || !workOrder.canDispatch}
              onClick={onDispatch}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {t("workOrderDetail.prejob.dispatch")}
            </Button>
          </Box>
        ) : null}
        {isAdmin && !dispatched && !workOrder.canDispatch ? (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "right" }}>
            {t("workOrderDetail.prejob.gateHint")}
          </Typography>
        ) : null}
      </Box>
    </Card>
  );
}
