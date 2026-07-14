import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { StatusBadge } from "../../../components/StatusBadge";
import { STATUS_TONES } from "../../../theme/tokens";
import { euro } from "../constants";
import type { WorkOrderMaterial } from "../api";

// ONE invoice line (opero-old's "Taak" row), kept deliberately QUIET:
//   ☐ · description · [Open/Klaar] · qty unit · €total (margin for admin) · 🗑
// Read-first: everything renders as plain text. Editing is on demand — click the
// description to rename, click the quantity to change it. The article itself is
// picked in the "Taak toevoegen" dialog; a wrong line is deleted and re-added
// (no inline catalog dropdowns — the resolved name already says what it is).
// Prices follow the 3-way rule: technician none · client sell · admin sell+margin.
export function TaskLineRow({
  material,
  canWrite,
  showPrices,
  showMargin,
  busy,
  onToggle,
  onDelete,
  onChangeQuantity,
  onChangeLabel,
}: {
  material: WorkOrderMaterial;
  canWrite: boolean;
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onChangeQuantity: (quantity: number) => void;
  onChangeLabel: (label: string) => void;
}) {
  const { t } = useTranslation();
  const m = material;
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingQty, setEditingQty] = useState(false);

  const description = m.label?.trim() || m.name || t("workOrderDetail.line.unnamed");
  const lineTotal = m.unitPrice != null ? m.quantity * m.unitPrice : null;

  const commitLabel = (raw: string) => {
    setEditingLabel(false);
    const v = raw.trim();
    if (v !== (m.label ?? "")) onChangeLabel(v);
  };

  const commitQty = (raw: string) => {
    setEditingQty(false);
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    if (n !== m.quantity) onChangeQuantity(n);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        minHeight: 40,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Checkbox
        checked={m.done}
        onChange={onToggle}
        disabled={!canWrite || busy}
        size="small"
        sx={{ p: 0.5, ml: -0.5 }}
      />

      {/* Description — plain text; click to rename (canWrite). */}
      {editingLabel && canWrite ? (
        <TextField
          variant="standard"
          defaultValue={m.label ?? ""}
          placeholder={m.name}
          autoFocus
          size="small"
          sx={{ flex: 1, minWidth: 120 }}
          onBlur={(e) => commitLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditingLabel(false);
          }}
        />
      ) : (
        <Typography
          variant="body2"
          onClick={canWrite && !busy ? () => setEditingLabel(true) : undefined}
          title={canWrite ? t("workOrderDetail.line.renameHint") : undefined}
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: canWrite ? "text" : "default",
            color: m.done ? "text.secondary" : "text.primary",
            textDecoration: m.done ? "line-through" : "none",
          }}
        >
          {description}
        </Typography>
      )}

      <StatusBadge
        label={m.done ? t("workOrderDetail.line.statusDone") : t("workOrderDetail.line.statusOpen")}
        tone={m.done ? STATUS_TONES.success : STATUS_TONES.neutral}
      />

      {/* Quantity — text; click to edit (canWrite). */}
      {editingQty && canWrite ? (
        <TextField
          variant="standard"
          defaultValue={String(m.quantity)}
          autoFocus
          size="small"
          sx={{ width: 56 }}
          slotProps={{ htmlInput: { inputMode: "decimal", style: { textAlign: "right" } } }}
          onBlur={(e) => commitQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditingQty(false);
          }}
        />
      ) : (
        <Typography
          variant="body2"
          onClick={canWrite && !busy ? () => setEditingQty(true) : undefined}
          sx={{
            color: "text.secondary",
            whiteSpace: "nowrap",
            cursor: canWrite ? "text" : "default",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {m.quantity} {m.unit}
        </Typography>
      )}

      {/* Price (3-way): admin sell+margin · client sell · technician nothing. */}
      {showPrices && lineTotal != null ? (
        <Box sx={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 64 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {euro(lineTotal)}
          </Typography>
          {showMargin && m.margin != null ? (
            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600, display: "block" }}>
              {t("workOrderDetail.line.margin", { amount: euro(m.margin), pct: Math.round(m.marginPct ?? 0) })}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {canWrite ? (
        <IconButton
          size="small"
          aria-label={t("workOrderDetail.line.delete")}
          onClick={onDelete}
          disabled={busy}
          sx={{ p: 0.5, mr: -0.5 }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Box>
  );
}
