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

// One ZONE = one WorkOrderTask. Layout mirrors opero-old's project-detail
// (the layout the client prefers):
//   TAAK            → zone title
//   STATUS          → derived badge (all named lines done → Klaar)
//   WERKOMSCHRIJVING→ the zone note
//   TAKEN           → the invoice-line rows + total
//   FOTOS           → vooraf | resultaat side by side
// Zone status is DERIVED from the lines — there is no zone-level checkbox.
export function ZoneCard({
  task,
  canWrite,
  canEditScope,
  canManageZones,
  showPrices,
  showMargin,
  busy,
  dragHandle,
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
  // canEditScope. See shared/src/permissions.ts.
  canManageZones: boolean;
  // 3-way price rule: admin sees price + margin, client sees price, technician
  // sees neither. Derived from canSeePrices/canSeeMargin on the page.
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  // The drag grip (top-left), supplied by SortableRow when reordering is on.
  // Undefined when there's nothing to reorder (≤1 zone, or not office).
  dragHandle?: React.ReactNode;
  onRename: (description: string) => void;
  onSetNote: (note: string) => void;
  onDeleteZone: () => void;
  onAddLine: (input: { variantId: string; quantity: number; isExtraWork?: boolean }) => void;
  onAddCustomLine: (input: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    isExtraWork?: boolean;
  }) => void;
  onEditLine: (
    matId: string,
    input: { variantId: string; quantity: number; isExtraWork?: boolean },
  ) => void;
  onEditCustomLine: (
    matId: string,
    input: {
      name: string;
      quantity: number;
      unit: string;
      unitPrice?: number;
      isExtraWork?: boolean;
    },
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
        {/* Card top row — drag grip on the LEFT, delete on the RIGHT, on their
            own line above the fields (matches the old layout). Rendered only
            when there's something to do: the grip when reordering is on, the
            trash for the office. */}
        {dragHandle || canManageZones ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: -0.5, mb: -1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>{dragHandle}</Box>
            {canManageZones ? (
              <IconButton
                size="small"
                aria-label={t("workOrderDetail.zone.deleteAria")}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                sx={{ mr: -0.5, color: "text.secondary", "&:hover": { color: "error.main" } }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Box>
        ) : null}

        {/* TAAK — zone title. */}
        <Box>
          <Typography
            variant="caption"
            sx={{ display: "block", mb: 0.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            {t("workOrderDetail.zone.titleLabel")}
          </Typography>
          {/* Zone title is SCOPE — it names what was sold, so office-only. */}
          {canEditScope ? (
            <TextField
              defaultValue={task.description}
              key={`zt-${task.id}-${task.description}`}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== task.description) onRename(v);
              }}
              placeholder={t("workOrderDetail.zone.titlePlaceholder")}
              size="small"
              fullWidth
              sx={{ "& input": { fontWeight: 600 } }}
            />
          ) : (
            <Typography sx={{ fontWeight: 600, fontSize: 17 }}>
              {task.description || t("workOrderDetail.zone.untitled")}
            </Typography>
          )}
        </Box>

        {/* STATUS — derived badge, its own labelled block (matches old layout). */}
        <Box>
          <Typography
            variant="caption"
            sx={{ display: "block", mb: 0.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            {t("workOrderDetail.zone.statusLabel")}
          </Typography>
          <StatusBadge
            label={complete ? t("workOrderDetail.zone.statusDone") : t("workOrderDetail.zone.statusTodo")}
            tone={complete ? STATUS_TONES.success : STATUS_TONES.neutral}
          />
        </Box>

        {/* WERKOMSCHRIJVING — the zone note. Second-from-top in the old layout,
            directly under status and above TAKEN. */}
        {canWrite ? (
          <Box>
            <Typography
              variant="caption"
              sx={{ display: "block", mb: 0.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              {t("workOrderDetail.zone.workDescriptionLabel")}
            </Typography>
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
              minRows={2}
            />
          </Box>
        ) : task.note ? (
          <Box>
            <Typography
              variant="caption"
              sx={{ display: "block", mb: 0.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              {t("workOrderDetail.zone.workDescriptionLabel")}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {task.note}
            </Typography>
          </Box>
        ) : null}

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

        {/* FOTOS — vooraf | resultaat side by side, under a section label to
            match the old layout. */}
        <Box>
          <Typography
            variant="caption"
            sx={{ display: "block", mb: 0.5, color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}
          >
            {t("workOrderDetail.photos.title")}
          </Typography>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              {t("workOrderDetail.photos.before")}
            </Typography>
            <PhotoGrid
              // Stable key per phase: these two grids are same-type siblings, so
              // without it React reconciles them POSITIONALLY and can carry one
              // grid's internal state (its pending-upload tiles) into the other —
              // a photo added to "resultaat" showing a spinner under "vooraf".
              key="before"
              photos={task.beforePhotos}
              canEdit={canWrite}
              busy={busy}
              onAdd={(file) => onUploadPhoto("before", file)}
              onRemove={(key) => onDeletePhoto(key)}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              {t("workOrderDetail.photos.result")}
            </Typography>
            <PhotoGrid
              key="result"
              photos={task.resultPhotos}
              canEdit={canWrite}
              busy={busy}
              onAdd={(file) => onUploadPhoto("result", file)}
              onRemove={(key) => onDeletePhoto(key)}
            />
          </Box>
          </Box>
        </Box>
      </Box>

      <AddTaskLineDialog
        open={pickerOpen}
        busy={busy}
        showMargin={showMargin}
        canSetPrice={showPrices}
        canFlagExtraWork={canEditScope}
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
              canFlagExtraWork={canEditScope}
              initial={
                isCatalogLine
                  ? {
                      materialId: editingLine.variantMaterialId!,
                      size: editingLine.variantSize!,
                      variantId: editingLine.variantId!,
                      quantity: editingLine.quantity,
                      isExtraWork: editingLine.isExtraWork,
                    }
                  : {
                      quantity: editingLine.quantity,
                      isExtraWork: editingLine.isExtraWork,
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
