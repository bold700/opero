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
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { Card } from "../../../components/Card";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { AddChecklistItemDialog } from "./AddChecklistItemDialog";
import { SortableRow } from "../../../components/SortableRow";
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
  canComplete,
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
  canComplete: boolean;
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
  const [addOpen, setAddOpen] = useState(false);
  const dispatched = Boolean(workOrder.dispatchedAt);
  const editable = isAdmin && !dispatched;
  const canTick = canComplete && !dispatched;
  const items = [...workOrder.prejobItems].sort((a, b) => a.ordinal - b.ordinal);

  // Drag-to-reorder — the same dnd-kit setup as the zones (TasksPanel): a
  // pointer sensor with a small distance threshold so taps/clicks inside the
  // row never start a drag, and only the grip handle activates one.
  const canDrag = editable && !busy && items.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    // Same payload the arrows used to send: the full ordered id list.
    onMoveItem(arrayMove(items, from, to).map((i) => i.id));
  };

  // The checklist is the OFFICE's dispatch gate — every control in it is
  // admin/office-gated on the backend too, so to a technician (or client) the
  // full panel is a wall of dead checkboxes plus instructions addressed to
  // someone else, which reads as broken. The one thing a non-office viewer can
  // genuinely use is the pre-job PHOTOS: show a minimal photos-only card when
  // any exist, and otherwise nothing at all.
  if (!isAdmin && !canComplete) {
    if (workOrder.prejobPhotos.length === 0) return null;
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
            {t("workOrderDetail.prejob.photos")}
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
        <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
          <PhotoGrid photos={workOrder.prejobPhotos} canEdit={false} busy={busy} />
        </Box>
      </Card>
    );
  }

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

        {/* Checklist — editable inline for admin (pre-dispatch). Reorder by
            dragging the grip (same interaction as the zones), not arrows. */}
        <Box>
          {(() => {
            const renderItem = (item: (typeof items)[number], dragHandle?: React.ReactNode) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox
                  checked={item.done}
                  disabled={!canTick || busy}
                  onChange={(e) => onToggleCheck(item.id, e.target.checked)}
                  // Tight padding: the outlined field beside it needs the
                  // horizontal room on a phone. The row's own height still
                  // keeps the control at a comfortable tap size.
                  sx={{ p: 0.5 }}
                />
                {editable ? (
                  <>
                    <TextField
                      size="small"
                      defaultValue={item.label}
                      key={`${item.id}-${item.label}`}
                      disabled={busy}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== item.label) onRenameItem(item.id, v);
                      }}
                      // minWidth:0 or the input's intrinsic ~180px floor pushes
                      // the icon buttons off the right edge on a phone.
                      sx={{ flex: 1, minWidth: 0 }}
                    />
                    {item.reminderEnabled && item.reminderTime ? (
                      <Chip
                        size="small"
                        icon={<AccessTimeOutlinedIcon />}
                        label={t("workOrderDetail.prejob.reminder", {
                          time: item.reminderTime,
                        })}
                      />
                    ) : null}
                    {dragHandle ?? null}
                    <IconButton size="small" color="error" disabled={busy} onClick={() => onRemoveItem(item.id)} aria-label={t("workOrderDetail.prejob.removeItem")}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ flex: 1, py: 1 }}>
                      {item.label}
                    </Typography>
                    {item.reminderEnabled && item.reminderTime ? (
                      <Chip
                        size="small"
                        icon={<AccessTimeOutlinedIcon />}
                        label={t("workOrderDetail.prejob.reminder", {
                          time: item.reminderTime,
                        })}
                      />
                    ) : null}
                  </>
                )}
              </Box>
            );

            return canDrag ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {items.map((item) => (
                      <SortableRow key={item.id} id={item.id} ariaLabel={t("workOrderDetail.prejob.reorderAria")}>
                        {(dragHandle) => renderItem(item, dragHandle)}
                      </SortableRow>
                    ))}
                  </Box>
                </SortableContext>
              </DndContext>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {items.map((item) => (
                  <Box key={item.id}>{renderItem(item)}</Box>
                ))}
              </Box>
            );
          })()}

          {editable ? (
            // Same flow as "Taak toevoegen": a button opens a dialog to type the
            // item, rather than an always-present inline field in the card.
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              disabled={busy}
              sx={{ mt: 1, ml: -0.5 }}
            >
              {t("workOrderDetail.prejob.addItemNew")}
            </Button>
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

      <AddChecklistItemDialog
        open={addOpen}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onAdd={onAddItem}
      />
    </Card>
  );
}
