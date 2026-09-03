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
import { euro, extraWorkBadge } from "../constants";
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
  onOpen,
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
  // Open the line's registration (progress + stock). The description is the
  // tap target, so the row itself stays quiet.
  onOpen?: () => void;
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

  // --- Shared cell fragments, composed differently per breakpoint below. ---

  const statusBadge = (
    <StatusBadge
      label={m.done ? t("workOrderDetail.line.statusDone") : t("workOrderDetail.line.statusOpen")}
      tone={m.done ? STATUS_TONES.success : STATUS_TONES.neutral}
    />
  );

  // Meerwerk marker + where it stands in the approval chain. Only meerwerk
  // lines carry the approval flags, so this is the one visible difference
  // between a sold line and an extra-work line.
  const meerwerkBadges = m.isExtraWork ? (
    <>
      <StatusBadge label={t("workOrderDetail.line.extraWork")} tone={STATUS_TONES.open} />
      <StatusBadge
        label={t(`workOrderDetail.extraWorkStatus.${extraWorkBadge(m).key}`)}
        tone={extraWorkBadge(m).tone}
      />
    </>
  ) : null;

  const quantityCell =
    editingQty && canEditScope ? (
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
      // Click-to-edit quantity: a real focusable button (dotted underline +
      // hover) so it reads as editable and works by keyboard.
      <Typography
        component="button"
        type="button"
        variant="body2"
        disabled={busy}
        aria-label={t("workOrderDetail.line.editQuantityAria", { quantity: m.quantity, unit: m.unit })}
        onClick={() => setEditingQty(true)}
        sx={{
          color: "text.secondary",
          whiteSpace: "nowrap",
          font: "inherit",
          border: "none",
          background: "none",
          p: 0,
          cursor: "pointer",
          textDecoration: "underline dotted",
          textUnderlineOffset: 3,
          "&:hover": { color: "text.primary" },
          "&:disabled": { cursor: "default", textDecoration: "none" },
        }}
      >
        {m.quantity} {m.unit}
      </Typography>
    ) : (
      <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
        {m.quantity} {m.unit}
      </Typography>
    );

  const priceCell =
    showPrices && lineTotal != null ? (
      <Box sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {euro(lineTotal)}
        </Typography>
        {showMargin && m.margin != null ? (
          <Typography
            variant="caption"
            sx={{ color: "success.main", fontWeight: 600, display: "block" }}
          >
            {t("workOrderDetail.line.margin", { amount: euro(m.margin), pct: Math.round(m.marginPct ?? 0) })}
          </Typography>
        ) : null}
      </Box>
    ) : null;

  // Unaccounted stock only computes against a known issue amount.
  const unaccounted =
    m.issuedQuantity != null
      ? m.issuedQuantity - (m.usedQuantity ?? 0) - (m.returnedQuantity ?? 0)
      : null;

  const actionButtons = canEditScope ? (
    <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {onEdit ? (
        <Tooltip title={t("workOrderDetail.line.editAria")}>
          <IconButton
            size="small"
            aria-label={t("workOrderDetail.line.editAria")}
            onClick={onEdit}
            disabled={busy}
            sx={{ p: 0.5 }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title={t("workOrderDetail.line.delete")}>
        <IconButton
          size="small"
          aria-label={t("workOrderDetail.line.delete")}
          onClick={onDelete}
          disabled={busy}
          sx={{ p: 0.5 }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  ) : null;

  // One quiet caption for what was registered on the line: progress so far
  // and, when stock was issued, what is still unaccounted for.
  const registrationParts = [
    m.progressEntries.length > 0
      ? t("workOrderDetail.progress.summary", { total: m.progressTotal, target: m.quantity, unit: m.unit })
      : null,
    unaccounted !== null && unaccounted > 0
      ? t("workOrderDetail.stock.unaccountedShort", { quantity: unaccounted, unit: m.unit })
      : null,
  ].filter(Boolean);
  const registrationSummary =
    registrationParts.length > 0 ? (
      <Typography
        variant="caption"
        sx={{ display: "block", color: unaccounted !== null && unaccounted > 0 ? "warning.main" : "text.secondary" }}
      >
        {registrationParts.join(" · ")}
      </Typography>
    ) : null;

  const descriptionText = (
    <Typography
      variant="body2"
      sx={{
        minWidth: 0,
        // Mobile WRAPS; desktop keeps the single-line ellipsis.
        //
        // `nowrap` + ellipsis only collapses once the box is already bounded —
        // in a flex row of nowrap siblings it still reports its full intrinsic
        // width and pushes the page sideways instead (measured: 55px of overflow
        // on a 375px screen from this alone). Wrapping removes the floor.
        overflow: { xs: "visible", sm: "hidden" },
        textOverflow: { xs: "clip", sm: "ellipsis" },
        whiteSpace: { xs: "normal", sm: "nowrap" },
        overflowWrap: "anywhere",
        color: m.done ? "text.secondary" : "text.primary",
        textDecoration: m.done ? "line-through" : "none",
      }}
    >
      {description}
    </Typography>
  );

  // Tapping the description opens the registration dialog (technicians too);
  // a real button, so it works by keyboard and reads as tappable on hover.
  const descriptionCell = onOpen ? (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      disabled={busy}
      sx={{
        all: "unset",
        display: "block",
        width: "100%",
        cursor: "pointer",
        "&:hover p:first-of-type": { textDecoration: "underline" },
      }}
    >
      {descriptionText}
      {registrationSummary}
    </Box>
  ) : (
    <>
      {descriptionText}
      {registrationSummary}
    </>
  );

  const checkbox = (
    <Checkbox
      checked={m.done}
      onChange={onToggle}
      disabled={!canWrite || busy}
      size="small"
      sx={{ p: 0.5, ml: -0.5, flexShrink: 0 }}
    />
  );

  return (
    <Box
      sx={{
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      {/* DESKTOP (sm+): one row — ☐ description [status] qty €total ✎ 🗑 */}
      <Box
        sx={{
          display: { xs: "none", sm: "flex" },
          alignItems: "center",
          gap: 1.5,
          minHeight: 32,
        }}
      >
        {checkbox}
        <Box sx={{ flex: 1, minWidth: 0 }}>{descriptionCell}</Box>
        {statusBadge}
        {meerwerkBadges}
        <Box sx={{ minWidth: 48, textAlign: "right" }}>{quantityCell}</Box>
        {priceCell ? <Box sx={{ minWidth: 72 }}>{priceCell}</Box> : null}
        {actionButtons}
      </Box>

      {/* MOBILE (xs): two aligned rows.
          Row 1 — ☐ description ................................ ✎ 🗑
          Row 2 — (indent) [status]  qty ............... €total
          The action buttons live on row 1 (top-aligned with the description),
          and everything on row 2 is indented to line up under the description,
          so nothing floats vertically-centred across both rows. */}
      <Box sx={{ display: { xs: "block", sm: "none" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {checkbox}
          <Box sx={{ flex: 1, minWidth: 0 }}>{descriptionCell}</Box>
          {actionButtons}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            // MUST wrap: every child here is whiteSpace:"nowrap" (status badge,
            // meerwerk badges, quantity, price), so without this the row has an
            // unshrinkable minimum that overflows a 375px screen — a meerwerk
            // line measured 99px past the viewport.
            flexWrap: "wrap",
            rowGap: 0.5,
            // Indent so row 2 lines up under the description text: the small
            // checkbox box is ~30px, shifted -4px by ml, plus the 8px gap → the
            // description starts ~34px in. Match that here.
            pl: "34px",
            mt: 0.5,
          }}
        >
          {statusBadge}
          {meerwerkBadges}
          {quantityCell}
          {priceCell ? <Box sx={{ ml: "auto" }}>{priceCell}</Box> : null}
        </Box>
      </Box>
    </Box>
  );
}
