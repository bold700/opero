import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField, type SelectOption } from "../../../components/SelectField";
import { useApi } from "../../../lib/api/useApi";
import {
  getMaterialGroups,
  getMaterial,
  type MaterialVariant,
} from "../../materials/api";
import {
  CLASS_LABEL_KEYS,
  COMPONENT_LABEL_KEYS,
  COMPONENT_ORDER,
  SIZE_UNIT_LABEL_KEYS,
  formatPrice,
} from "../../materials/constants";

// "Taak toevoegen" — add an invoice line to a zone, from EITHER source:
//
//   catalog — pick article → size (Ø) → component, plus an amount (Aantal).
//             Only the variant id + quantity are submitted; name/unit/price
//             resolve SERVER-side (a technician's response has prices stripped,
//             so the price shown here is display only, never the source of
//             truth). `showMargin` annotates the margin for admins.
//   custom  — type the description, quantity, unit and price by hand, for
//             miscellaneous material that isn't in the catalog (WOB Isolatie
//             feedback: "allow custom or miscellaneous materials to be added").
//             The price field is the one place a line price is typed rather
//             than resolved, which is why the whole dialog is office-only.
//
// `mode="edit"` with `initial` reuses the same dialog to CHANGE an existing
// line: a catalog line opens with the cascade pre-selected to its current
// article so it can be re-pointed in place; a free-text line opens on the
// custom tab with its typed fields. Free-text lines previously had no edit
// path at all — the pencil was hidden when there was no variantId.
export function AddTaskLineDialog({
  open,
  busy,
  mode = "add",
  initial,
  showMargin = false,
  canSetPrice = false,
  canFlagExtraWork = false,
  onClose,
  onAdd,
  onAddCustom,
}: {
  open: boolean;
  busy: boolean;
  mode?: "add" | "edit";
  initial?: {
    materialId?: string;
    size?: string;
    variantId?: string;
    quantity: number;
    // Present for a free-text line → dialog opens on the custom tab.
    custom?: { name: string; unit: string; unitPrice: number | null };
    isExtraWork?: boolean;
  };
  showMargin?: boolean;
  // Only an admin may type a price. Kept as a prop rather than read from the
  // role here so the dialog stays presentational.
  canSetPrice?: boolean;
  // Only the office may classify a line as meerwerk (it moves money between the
  // quote and the extra-work bucket). Omitted/false → the checkbox is hidden.
  canFlagExtraWork?: boolean;
  onClose: () => void;
  onAdd: (input: { variantId: string; quantity: number; isExtraWork?: boolean }) => void;
  // Omitted → the custom tab is not offered at all.
  onAddCustom?: (input: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice?: number;
    isExtraWork?: boolean;
  }) => void;
}) {
  const { t } = useTranslation();
  const editing = mode === "edit";

  const { data: groups, loading: groupsLoading } = useApi(
    () => (open ? getMaterialGroups() : Promise.resolve(null)),
    [open],
  );

  const [source, setSource] = useState<"catalog" | "custom">("catalog");
  const [materialId, setMaterialId] = useState("");
  const [size, setSize] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("stuk");
  const [customPrice, setCustomPrice] = useState("");
  const [isExtraWork, setIsExtraWork] = useState(false);

  useEffect(() => {
    if (open) {
      // Edit mode seeds from the current line so it opens on the right tab,
      // pre-filled; add mode starts blank on the catalog tab.
      setSource(initial?.custom ? "custom" : "catalog");
      setMaterialId(initial?.materialId ?? "");
      setSize(initial?.size ?? "");
      setVariantId(initial?.variantId ?? "");
      setQuantity(initial?.quantity != null ? String(initial.quantity) : "1");
      setCustomName(initial?.custom?.name ?? "");
      setCustomUnit(initial?.custom?.unit || "stuk");
      setCustomPrice(
        initial?.custom?.unitPrice != null ? String(initial.custom.unitPrice) : "",
      );
      setIsExtraWork(initial?.isExtraWork ?? false);
    }
    // `initial` is a fresh object per open; depend on the primitive fields so we
    // don't reseed on every render while the dialog stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    initial?.materialId,
    initial?.size,
    initial?.variantId,
    initial?.quantity,
    initial?.custom?.name,
    initial?.custom?.unit,
    initial?.custom?.unitPrice,
    initial?.isExtraWork,
  ]);

  const { data: material, loading: materialLoading } = useApi(
    () => (materialId ? getMaterial(materialId) : Promise.resolve(null)),
    [materialId],
  );

  const materialOptions: SelectOption[] = (groups ?? []).flatMap((g) =>
    g.materials.map((m) => ({
      value: m.id,
      label: `${t(CLASS_LABEL_KEYS[g.class])} — ${m.name}`,
    })),
  );

  const sizes = useMemo(() => {
    const out: string[] = [];
    for (const v of material?.variants ?? []) {
      if (!out.includes(v.size)) out.push(v.size);
    }
    return out;
  }, [material]);

  const variantsForSize = useMemo(() => {
    const list = (material?.variants ?? []).filter((v) => v.size === size);
    return [...list].sort(
      (a, b) =>
        COMPONENT_ORDER.indexOf(a.component) - COMPONENT_ORDER.indexOf(b.component) ||
        (a.thicknessMm ?? 0) - (b.thicknessMm ?? 0),
    );
  }, [material, size]);

  const variantLabel = (v: MaterialVariant) => {
    const base =
      v.thicknessMm != null
        ? `${t(COMPONENT_LABEL_KEYS[v.component])} ${v.thicknessMm} mm`
        : t(COMPONENT_LABEL_KEYS[v.component]);
    if (v.unitPrice == null) return base;
    const marginSuffix =
      showMargin && v.costPrice != null
        ? ` (${t("workOrderDetail.line.marginShort", {
            amount: formatPrice(v.unitPrice - v.costPrice),
          })})`
        : "";
    return `${base} — ${formatPrice(v.unitPrice)}${marginSuffix}`;
  };

  const sizeOptions: SelectOption[] = sizes.map((s) => ({ value: s, label: s }));
  const variantOptions: SelectOption[] = variantsForSize.map((v) => ({
    value: v.id,
    label: variantLabel(v),
  }));

  // The custom tab is only offered when the page supplied a handler for it.
  const customEnabled = Boolean(onAddCustom);
  const isCustom = customEnabled && source === "custom";

  const qty = Number(quantity);
  const qtyOk = Number.isFinite(qty) && qty > 0;
  // An empty price is legal — it means "office prices this later" (null).
  const priceRaw = customPrice.trim().replace(",", ".");
  const priceNum = priceRaw === "" ? null : Number(priceRaw);
  const priceOk = priceNum === null || (Number.isFinite(priceNum) && priceNum >= 0);

  const canSubmit =
    !busy &&
    qtyOk &&
    (isCustom ? customName.trim().length > 0 && priceOk : Boolean(variantId));

  const submit = () => {
    if (!canSubmit) return;
    if (isCustom) {
      onAddCustom?.({
        name: customName.trim(),
        quantity: qty,
        unit: customUnit.trim() || "stuk",
        // Only send a price when the user may set one AND typed one.
        ...(canSetPrice && priceNum !== null ? { unitPrice: priceNum } : {}),
        ...(canFlagExtraWork ? { isExtraWork } : {}),
      });
      return;
    }
    onAdd({ variantId, quantity: qty, ...(canFlagExtraWork ? { isExtraWork } : {}) });
  };

  // Units mirror the catalog's LINE_UNIT_LABELS (backend materials/labels.ts),
  // in the org's document locale (nl) so a custom line reads like a catalog one.
  const unitOptions: SelectOption[] = [
    { value: "stuk", label: t("workOrderDetail.line.unitPiece") },
    { value: "meter", label: t("workOrderDetail.line.unitMetre") },
    { value: "m2", label: t("workOrderDetail.line.unitM2") },
  ];

  const titleKey = editing ? "workOrderDetail.line.editTitle" : "workOrderDetail.line.addTitle";
  const submitKey = editing ? "workOrderDetail.line.editSubmit" : "workOrderDetail.line.addSubmit";

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={t(titleKey)} stableHeight>
      <DialogTitle sx={{ fontWeight: 700 }}>{t(titleKey)}</DialogTitle>
      <DialogContent>
        {!isCustom ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
            {t("workOrderDetail.line.addSubtitle")}
          </Typography>
        ) : null}

        {/* Catalog vs custom. Hidden entirely when the page didn't supply a
            custom handler, so nothing changes for callers that don't want it. */}
        {customEnabled ? (
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={source}
            onChange={(_, v) => {
              if (v) setSource(v as "catalog" | "custom");
            }}
            sx={{
              mb: 1,
              // "Overig / handmatig" is ~152px against a ~163px half-width
              // button — one label tweak from overflowing. Allow it to wrap
              // and shrink the type slightly instead of clipping.
              "& .MuiToggleButton-root": {
                whiteSpace: "normal",
                lineHeight: 1.25,
                px: 1,
                fontSize: { xs: 13, sm: 14 },
              },
            }}
          >
            <ToggleButton value="catalog">
              {t("workOrderDetail.line.sourceCatalog")}
            </ToggleButton>
            <ToggleButton value="custom">
              {t("workOrderDetail.line.sourceCustom")}
            </ToggleButton>
          </ToggleButtonGroup>
        ) : null}

        {isCustom ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label={t("workOrderDetail.line.customDescriptionLabel")}
              placeholder={t("workOrderDetail.line.customDescriptionPlaceholder")}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
              fullWidth
            />
            {/* Quantity + unit: side by side on desktop, STACKED on a phone.
                Two `flex: 1` fields still can't go below their intrinsic
                min-content (~180px each), and the unit renders as a NATIVE
                <select> on mobile with its own UA minimum — together ~376px
                against ~327px of sheet width, so they were cut off. */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                label={t("workOrderDetail.line.quantityLabel")}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
                fullWidth
              />
              <SelectField
                label={t("workOrderDetail.line.customUnitLabel")}
                value={customUnit}
                onChange={setCustomUnit}
                options={unitOptions}
                // Match the medium-height text fields beside it — SelectField
                // defaults to small, which left the unit box visibly shorter.
                size="medium"
                fullWidth
              />
            </Box>
            {/* Price is admin-only: the backend gates this route to admin, and
                a technician never sees prices at all. */}
            {canSetPrice ? (
              <TextField
                label={t("workOrderDetail.line.customPriceLabel")}
                helperText={t("workOrderDetail.line.customPriceHelp")}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                error={!priceOk}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                fullWidth
              />
            ) : null}
          </Box>
        ) : groupsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <SelectField
              label={t("workOrderDetail.line.articleLabel")}
              value={materialId}
              onChange={(v) => {
                setMaterialId(v);
                setSize("");
                setVariantId("");
              }}
              options={materialOptions}
              fullWidth
            />
            {materialId && materialLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={22} />
              </Box>
            ) : null}
            {material ? (
              <SelectField
                label={t(SIZE_UNIT_LABEL_KEYS[material.sizeUnit])}
                value={size}
                onChange={(v) => {
                  setSize(v);
                  setVariantId("");
                }}
                options={sizeOptions}
                fullWidth
              />
            ) : null}
            {size ? (
              <SelectField
                label={t("workOrderDetail.line.componentLabel")}
                value={variantId}
                onChange={setVariantId}
                options={variantOptions}
                fullWidth
              />
            ) : null}
            {variantId ? (
              <TextField
                label={t("workOrderDetail.line.quantityLabel")}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
                fullWidth
              />
            ) : null}
            {material?.note ? (
              <Typography variant="body2" color="text.secondary">
                {material.note}
              </Typography>
            ) : null}
          </Box>
        )}

        {/* Meerwerk: work the customer didn't buy. Ticking it keeps the line out
            of the quote and off the invoice until office AND client approve. */}
        {canFlagExtraWork ? (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isExtraWork}
                  onChange={(e) => setIsExtraWork(e.target.checked)}
                  disabled={busy}
                />
              }
              label={t("workOrderDetail.line.isExtraWork")}
            />
            {isExtraWork ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 4 }}>
                {t("workOrderDetail.line.isExtraWorkHint")}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.actions.cancel")}</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {t(submitKey)}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
