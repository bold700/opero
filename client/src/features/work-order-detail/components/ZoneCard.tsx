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
import type { WorkOrderMaterial, WorkOrderTask } from "../api";
import { TaskLineRow } from "./TaskLineRow";
import { AddTaskLineDialog } from "./AddTaskLineDialog";
import { isZoneComplete } from "./zoneStatus";

// One ZONE = one WorkOrderTask, kept visually QUIET. Layout:
//   [zone title · status badge · delete]      ← one header line
//   TAKEN: the invoice-line rows + total       ← the core of the card
//   photos (vooraf | resultaat side by side)
//   werkomschrijving                           ← LAST, below the photos
// The werkomschrijving sits at the bottom on purpose: directly under the title
// it crowded the title field and the two got mistaken for each other.
// Zone status is DERIVED from the lines (all named lines done → Klaar) — there
// is no zone-level checkbox.
export function ZoneCard({
  task,
  canWrite,
  canEditScope,
  canManageZones,
  showPrices,
  showMargin,
  busy,
  onRename,
  onSetNote,
  onDeleteZone,
  onAddLine,
  onAddCustomLine,
  onEditLine,
  onEditCustomLine,
  onDeleteLine,
  onToggleLine,
  onChangeLineQuantity,
  onUploadPhoto,
  onDeletePhoto,
}: {
  task: WorkOrderTask;
  // Register what happened on site: tick lines, notes, photos. Technicians too.
  canWrite: boolean;
  // Change what was SOLD: zone title, line add/edit/delete. Office only —
  // all of it moves the invoiced amount. See WorkOrderDetail's canEditScope.
  canEditScope: boolean;
  // Creating/deleting a ZONE is office work (admin-only) — a subset of
  // canEditScope. See docs/roles-and-permissions.md.
  canManageZones: boolean;
  // 3-way price rule: admin sees price + margin, client sees price, technician
  // sees neither. Derived from canSeePrices/canSeeMargin on the page.
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onRename: (description: string) => void;
  onSetNote: (note: string) => void;
  onDeleteZone: () => void;
  onAddLine: (input: { variantId: string; quantity: number }) => void;
  onAddCustomLine: (input: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
  }) => void;
  onEditLine: (matId: string, input: { variantId: string; quantity: number }) => void;
  onEditCustomLine: (
    matId: string,
    input: { name: string; quantity: number; unit: string; unitPrice?: number },
  ) => void;
  onDeleteLine: (matId: string) => void;
  onToggleLine: (matId: string) => void;
  onChangeLineQuantity: (matId: string, quantity: number) => void;
  onUploadPhoto: (kind: "before" | "result", file: File) => void;
  onDeletePhoto: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<WorkOrderMaterial | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const complete = isZoneComplete(task);
  const namedLines = task.materials.filter(
    (m) => (m.name ?? "").trim() || (m.label ?? "").trim(),
  );
  const zoneTotal = task.materials.reduce((s, m) => s + m.quantity * (m.unitPrice ?? 0), 0);
  const zoneMargin = task.materials.reduce((s, m) => s + (m.margin ?? 0), 0);

  return (
    // Tighter padding on a phone. The shared Card's default p:3 costs 48px of
    // horizontal space, which a 375px screen can't spare once the page padding
    // is also taken — the task lines inside are the densest rows in the app.
    // Scoped to ZoneCard rather than changed on Card itself, so this stays a
    // fix for this screen and not an app-wide restyle.
    <Card sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Header: title · status · delete.
            The title takes a whole line on a phone: `flex: 1` alone doesn't
            shrink an <input> below its ~180px intrinsic min-content width, so
            with the status badge ("Nog te doen", ~92px) and the delete button
            the header needed ~326px and bled past the card. `minWidth: 0` lets
            it shrink, and the wrap gives it a full line when it still can't. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {/* Zone title is SCOPE — it names what was sold, so office-only. */}
          {canEditScope ? (
            <TextField
              variant="standard"
              defaultValue={task.description}
              key={`zt-${task.id}-${task.description}`}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== task.description) onRename(v);
              }}
              placeholder={t("workOrderDetail.zone.titlePlaceholder")}
              sx={{
                flex: "1 1 60%",
                minWidth: 0,
                "& input": { fontWeight: 600, fontSize: 17 },
              }}
            />
          ) : (
            <Typography sx={{ flex: "1 1 60%", minWidth: 0, fontWeight: 600, fontSize: 17 }}>
              {task.description || t("workOrderDetail.zone.untitled")}
            </Typography>
          )}
          <StatusBadge
            label={complete ? t("workOrderDetail.zone.statusDone") : t("workOrderDetail.zone.statusTodo")}
            tone={complete ? STATUS_TONES.success : STATUS_TONES.neutral}
          />
          {canManageZones ? (
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

        {/* TAKEN — the invoice lines + zone total (price gated per role). */}
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
                canEditScope={canEditScope}
                showPrices={showPrices}
                showMargin={showMargin}
                busy={busy}
                onToggle={() => onToggleLine(m.id)}
                onEdit={() => setEditingLine(m)}
                onDelete={() => onDeleteLine(m.id)}
                onChangeQuantity={(q) => onChangeLineQuantity(m.id, q)}
              />
            ))
          )}

          {/* Adding a line adds to the invoice → office only. A monteur who
              needs more than was sold reports meerwerk instead. */}
          {canEditScope ? (
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

        {/* Werkomschrijving — deliberately LAST, below the photos. It sat
            directly under the zone title before, where the two fields read as
            one block and got confused for each other (WOB Isolatie feedback,
            17-07-2026). Labelled now, so its purpose is clear this far down. */}
        {canWrite ? (
          <TextField
            label={t("workOrderDetail.zone.workDescriptionLabel")}
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
            minRows={2}
          />
        ) : task.note ? (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
              {t("workOrderDetail.zone.workDescriptionLabel")}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {task.note}
            </Typography>
          </Box>
        ) : null}
      </Box>

      <AddTaskLineDialog
        open={pickerOpen}
        busy={busy}
        showMargin={showMargin}
        canSetPrice={showPrices}
        onClose={() => setPickerOpen(false)}
        onAdd={(input) => {
          onAddLine(input);
          setPickerOpen(false);
        }}
        onAddCustom={(input) => {
          onAddCustomLine(input);
          setPickerOpen(false);
        }}
      />

      {/* Edit an existing line — the same dialog, seeded from the line. A
          catalog line (variantId + its material/size) opens with the cascade
          pre-selected; anything else is free text and opens on the custom tab.
          Both are handled: free-text lines used to have no edit path at all. */}
      {editingLine ? (
        (() => {
          const isCatalogLine = Boolean(
            editingLine.variantId &&
              editingLine.variantMaterialId &&
              editingLine.variantSize,
          );
          return (
            <AddTaskLineDialog
              open
              mode="edit"
              busy={busy}
              showMargin={showMargin}
              canSetPrice={showPrices}
              initial={
                isCatalogLine
                  ? {
                      materialId: editingLine.variantMaterialId!,
                      size: editingLine.variantSize!,
                      variantId: editingLine.variantId!,
                      quantity: editingLine.quantity,
                    }
                  : {
                      quantity: editingLine.quantity,
                      custom: {
                        name: editingLine.label?.trim() || editingLine.name || "",
                        unit: editingLine.unit,
                        unitPrice: editingLine.unitPrice ?? null,
                      },
                    }
              }
              onClose={() => setEditingLine(null)}
              onAdd={(input) => {
                onEditLine(editingLine.id, input);
                setEditingLine(null);
              }}
              onAddCustom={(input) => {
                onEditCustomLine(editingLine.id, input);
                setEditingLine(null);
              }}
            />
          );
        })()
      ) : null}

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
