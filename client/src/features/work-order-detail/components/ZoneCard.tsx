import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { Card } from "../../../components/Card";
import { PhotoGrid } from "../../../components/PhotoGrid";
import { StatusBadge } from "../../../components/StatusBadge";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { STATUS_TONES } from "../../../theme/tokens";
import { euro } from "../constants";
import type { WorkOrderTask } from "../api";
import { TaskLineRow } from "./TaskLineRow";
import { AddTaskLineDialog } from "./AddTaskLineDialog";
import { isZoneComplete } from "./zoneStatus";

// One ZONE = one WorkOrderTask, kept visually QUIET. Layout:
//   [zone title · status badge · delete]      ← one header line
//   werkomschrijving (only line of helper text)
//   type werk · monteur                        ← two compact selects
//   TAKEN: the invoice-line rows + total       ← the core of the card
//   photos (vooraf | resultaat side by side)
// Zone status is DERIVED from the lines (all named lines done → Klaar) — there
// is no zone-level checkbox.
export function ZoneCard({
  task,
  canWrite,
  showPrices,
  showMargin,
  busy,
  onRename,
  onSetNote,
  onDeleteZone,
  onAddLine,
  onDeleteLine,
  onToggleLine,
  onChangeLineQuantity,
  onChangeLineLabel,
  onUploadPhoto,
  onDeletePhoto,
}: {
  task: WorkOrderTask;
  canWrite: boolean;
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onRename: (description: string) => void;
  onSetNote: (note: string) => void;
  onDeleteZone: () => void;
  onAddLine: (input: { variantId: string; quantity: number }) => void;
  onDeleteLine: (matId: string) => void;
  onToggleLine: (matId: string) => void;
  onChangeLineQuantity: (matId: string, quantity: number) => void;
  onChangeLineLabel: (matId: string, label: string) => void;
  onUploadPhoto: (kind: "before" | "result", file: File) => void;
  onDeletePhoto: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const complete = isZoneComplete(task);
  const namedLines = task.materials.filter(
    (m) => (m.name ?? "").trim() || (m.label ?? "").trim(),
  );
  const zoneTotal = task.materials.reduce((s, m) => s + m.quantity * (m.unitPrice ?? 0), 0);
  const zoneMargin = task.materials.reduce((s, m) => s + (m.margin ?? 0), 0);

  return (
    <Card>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Header: title · status · delete — ONE line. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {canWrite ? (
            <TextField
              variant="standard"
              defaultValue={task.description}
              key={`zt-${task.id}-${task.description}`}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== task.description) onRename(v);
              }}
              placeholder={t("workOrderDetail.zone.titlePlaceholder")}
              sx={{ flex: 1, "& input": { fontWeight: 600, fontSize: 17 } }}
            />
          ) : (
            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 17 }}>
              {task.description || t("workOrderDetail.zone.untitled")}
            </Typography>
          )}
          <StatusBadge
            label={complete ? t("workOrderDetail.zone.statusDone") : t("workOrderDetail.zone.statusTodo")}
            tone={complete ? STATUS_TONES.success : STATUS_TONES.neutral}
          />
          {canWrite ? (
            <IconButton
              size="small"
              aria-label={t("workOrderDetail.zone.deleteAria")}
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Box>

        {/* Werkomschrijving — one quiet field, no shouting label. */}
        {canWrite ? (
          <TextField
            defaultValue={task.note ?? ""}
            key={`zn-${task.id}-${task.note ?? ""}`}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (task.note ?? "")) onSetNote(v);
            }}
            placeholder={t("workOrderDetail.zone.workDescriptionPlaceholder")}
            size="small"
            fullWidth
            multiline
            minRows={1}
          />
        ) : task.note ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {task.note}
          </Typography>
        ) : null}

        {/* TAKEN — the invoice lines. */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              {t("workOrderDetail.line.sectionTitle")}
            </Typography>
            {showPrices && zoneTotal > 0 ? (
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {euro(zoneTotal)}
                {showMargin && zoneMargin > 0 ? (
                  <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>
                    {" "}· {t("workOrderDetail.line.marginTotal", { amount: euro(zoneMargin) })}
                  </Box>
                ) : null}
              </Typography>
            ) : null}
          </Box>

          {(canWrite ? task.materials : namedLines).length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("workOrderDetail.line.empty")}
            </Typography>
          ) : (
            (canWrite ? task.materials : namedLines).map((m) => (
              <TaskLineRow
                key={m.id}
                material={m}
                canWrite={canWrite}
                showPrices={showPrices}
                showMargin={showMargin}
                busy={busy}
                onToggle={() => onToggleLine(m.id)}
                onDelete={() => onDeleteLine(m.id)}
                onChangeQuantity={(q) => onChangeLineQuantity(m.id, q)}
                onChangeLabel={(lbl) => onChangeLineLabel(m.id, lbl)}
              />
            ))
          )}

          {canWrite ? (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setPickerOpen(true)}
              disabled={busy}
              sx={{ mt: 0.5, ml: -1 }}
            >
              {t("workOrderDetail.line.add")}
            </Button>
          ) : null}
        </Box>

        {/* Photos — vooraf | resultaat side by side. */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              {t("workOrderDetail.photos.before")}
            </Typography>
            <PhotoGrid
              photos={task.beforePhotos}
              canEdit={canWrite}
              busy={busy}
              onAdd={(file) => onUploadPhoto("before", file)}
              onRemove={(key) => onDeletePhoto(key)}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              {t("workOrderDetail.photos.result")}
            </Typography>
            <PhotoGrid
              photos={task.resultPhotos}
              canEdit={canWrite}
              busy={busy}
              onAdd={(file) => onUploadPhoto("result", file)}
              onRemove={(key) => onDeletePhoto(key)}
            />
          </Box>
        </Box>
      </Box>

      <AddTaskLineDialog
        open={pickerOpen}
        busy={busy}
        showMargin={showMargin}
        onClose={() => setPickerOpen(false)}
        onAdd={(input) => {
          onAddLine(input);
          setPickerOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t("workOrderDetail.zone.deleteTitle")}
        body={t("workOrderDetail.zone.deleteMessage")}
        confirmLabel={t("workOrderDetail.zone.deleteConfirm")}
        destructive
        busy={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDeleteZone();
          setConfirmDelete(false);
        }}
      />
    </Card>
  );
}
