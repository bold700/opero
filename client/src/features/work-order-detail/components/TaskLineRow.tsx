import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { StatusBadge } from "../../../components/StatusBadge";
import { STATUS_TONES } from "../../../theme/tokens";
import { euro } from "../constants";
import type { WorkOrderMaterial } from "../api";

// ONE invoice line (opero-old's "Taak" row), kept deliberately QUIET:
//   ☐ · description · [Open/Klaar] · qty unit · €total · ✎ · 🗑
// The description is READ-ONLY — it always shows the resolved catalog name, so
// it can never drift from the article the line points at. To change the
// article, use the edit (✎) button, which re-opens the picker on this line.
//
// TWO LEVELS OF WRITE (see WorkOrderDetail's canWrite/canEditScope):
//   canWrite     — tick the line done. Technicians included.
//   canEditScope — quantity, article, delete. Office only: these change what
//                  the customer is invoiced.
//
// PRICES ARE 3-WAY (client's rule): admin sees the price AND the margin, the
// client sees the price only, the technician sees no price at all. The gates
// come from canSeePrices/canSeeMargin on the page; the backend also strips the
// fields per role, so this is presentation only.
export function TaskLineRow({
  material,
  canWrite,
  canEditScope,
  showPrices,
  showMargin,
  busy,
  onToggle,
  onEdit,
  onDelete,
  onChangeQuantity,
}: {
  material: WorkOrderMaterial;
  canWrite: boolean;
  canEditScope: boolean;
  showPrices: boolean;
  showMargin: boolean;
  busy: boolean;
  onToggle: () => void;
  // Re-open the picker on this line (catalog article, or the free-text fields).
  onEdit?: () => void;
  onDelete: () => void;
  onChangeQuantity: (quantity: number) => void;
}) {
  const { t } = useTranslation();
  const m = material;
  const [editingQty, setEditingQty] = useState(false);

  const description = m.label?.trim() || m.name || t("workOrderDetail.line.unnamed");
  const lineTotal = m.unitPrice != null ? m.quantity * m.unitPrice : null;

  const commitQty = (raw: string) => {
    setEditingQty(false);
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    if (n !== m.quantity) onChangeQuantity(n);
  };

  return (
    // GRID, not a flex row, because the same seven cells have to lay out two
    // different ways.
    //
    // On a 375px phone a ZoneCard leaves ~295px of content width, but this row
    // as a single line needs ~322px (checkbox 28 + badge 57 + qty 48 + price 64
    // + two icons 56 + 72px of gaps) — ~370px for an admin once the margin
    // string widens the price cell. Only the description can shrink, so it
    // collapsed to an empty ellipsis and the row STILL bled past the card edge.
    //
    // So on xs it becomes two lines, which is what every other list in the app
    // does on mobile (see ResponsiveList):
    //   ☐ description……………………  ✎ 🗑
    //     [Klaar]   3 stuk        €37,50
    // Desktop (sm+) keeps the original single row, unchanged.
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "auto 1fr auto",
          sm: "auto minmax(0, 1fr) auto auto auto auto",
        },
        gridTemplateAreas: {
          xs: `"check desc actions" ". meta actions"`,
          sm: `"check desc status qty price actions"`,
        },
        alignItems: "center",
        columnGap: 1.5,
        rowGap: 0.5,
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
        sx={{ gridArea: "check", p: 0.5, ml: -0.5, justifySelf: "start" }}
      />

      {/* Description — always the resolved catalog name; not editable. */}
      <Typography
        variant="body2"
        sx={{
          gridArea: "desc",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: m.done ? "text.secondary" : "text.primary",
          textDecoration: m.done ? "line-through" : "none",
        }}
      >
        {description}
      </Typography>

      {/* Status · quantity · price.
          xs  → a real flex row on the second line, holding all three together.
          sm+ → `display: contents`, so these three become direct grid children
                again and land in their own columns exactly as before. */}
      <Box
        sx={{
          gridArea: { xs: "meta", sm: "auto" },
          display: { xs: "flex", sm: "contents" },
          alignItems: "center",
          gap: 1,
          minWidth: 0,
        }}
      >
        <StatusBadge
          label={m.done ? t("workOrderDetail.line.statusDone") : t("workOrderDetail.line.statusOpen")}
          tone={m.done ? STATUS_TONES.success : STATUS_TONES.neutral}
        />

        {/* Quantity — click to edit. It used to be bare text whose ONLY hint was
            a cursor change, which nobody found (WOB Isolatie feedback: "not
            immediately clear how materials can be edited"). Now it renders as a
            real button: dotted underline, hover background, focusable, and
            Enter/Space open it — so it reads as editable and works by keyboard. */}
        {editingQty && canEditScope ? (
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
        ) : canEditScope ? (
          <Typography
            component="button"
            type="button"
            variant="body2"
            disabled={busy}
            aria-label={t("workOrderDetail.line.editQuantityAria", {
              quantity: m.quantity,
              unit: m.unit,
            })}
            onClick={() => setEditingQty(true)}
            sx={{
              color: "text.secondary",
              whiteSpace: "nowrap",
              minWidth: 40,
              textAlign: "right",
              font: "inherit",
              border: "none",
              background: "none",
              px: 0.5,
              py: 0.25,
              borderRadius: 1,
              cursor: "pointer",
              textDecoration: "underline dotted",
              textUnderlineOffset: 3,
              "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              "&:disabled": { cursor: "default", textDecoration: "none" },
            }}
          >
            {m.quantity} {m.unit}
          </Typography>
        ) : (
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", whiteSpace: "nowrap", minWidth: 40, textAlign: "right" }}
          >
            {m.quantity} {m.unit}
          </Typography>
        )}

        {/* Price (3-way): admin sell+margin · client sell · technician nothing.
            On mobile `marginLeft: auto` pushes it to the right edge of the meta
            line; on desktop it's just another grid column. */}
        {showPrices && lineTotal != null ? (
          <Box
            sx={{
              textAlign: "right",
              whiteSpace: "nowrap",
              minWidth: 64,
              ml: { xs: "auto", sm: 0 },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {euro(lineTotal)}
            </Typography>
            {showMargin && m.margin != null ? (
              <Typography
                variant="caption"
                sx={{
                  color: "success.main",
                  fontWeight: 600,
                  display: "block",
                  // The margin string ("marge €12,34 (18%)") is ~110px and
                  // would otherwise set this cell's width, blowing the mobile
                  // line past the card. Let it wrap under the amount on xs
                  // instead of widening the column.
                  whiteSpace: { xs: "normal", sm: "nowrap" },
                }}
              >
                {t("workOrderDetail.line.margin", { amount: euro(m.margin), pct: Math.round(m.marginPct ?? 0) })}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </Box>

      {/* Actions. On xs the area spans BOTH rows (see gridTemplateAreas), so
          the buttons sit once at the right of the line rather than duplicating
          or squeezing the meta row. `display: contents` on sm+ restores the two
          separate desktop columns.
          Edit re-opens the line picker — the catalog article for a catalog
          line, the typed description/qty/unit for a free-text one. It used to
          be hidden entirely on free-text lines (no `m.variantId`), which left
          those rows with no edit path at all; the dialog handles both now.
          Tooltip'd because an unlabelled pencil was the other half of the
          "not clear how to edit" complaint. */}
      <Box
        sx={{
          gridArea: { xs: "actions", sm: "auto" },
          display: { xs: "flex", sm: "contents" },
          alignItems: "center",
        }}
      >
        {canEditScope && onEdit ? (
          <Tooltip title={t("workOrderDetail.line.editAria")}>
            <span>
              <IconButton
                size="small"
                aria-label={t("workOrderDetail.line.editAria")}
                onClick={onEdit}
                disabled={busy}
                sx={{ p: 0.5 }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}

        {canEditScope ? (
          <Tooltip title={t("workOrderDetail.line.delete")}>
            <span>
              <IconButton
                size="small"
                aria-label={t("workOrderDetail.line.delete")}
                onClick={onDelete}
                disabled={busy}
                sx={{ p: 0.5, mr: -0.5 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}
