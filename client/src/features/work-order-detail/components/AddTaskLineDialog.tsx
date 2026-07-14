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

// "Taak toevoegen" — add one invoice line to a zone, opero-old style: choose a
// standard article, an amount (Aantal), and a size (Ø). Only the chosen variant
// id + quantity are submitted; name/unit/price resolve SERVER-side (a
// technician's response has prices stripped, so the price shown here is display
// only, never the source of truth). `showMargin` annotates the margin for admins.
export function AddTaskLineDialog({
  open,
  busy,
  showMargin = false,
  onClose,
  onAdd,
}: {
  open: boolean;
  busy: boolean;
  showMargin?: boolean;
  onClose: () => void;
  onAdd: (input: { variantId: string; quantity: number }) => void;
}) {
  const { t } = useTranslation();

  const { data: groups, loading: groupsLoading } = useApi(
    () => (open ? getMaterialGroups() : Promise.resolve(null)),
    [open],
  );

  const [materialId, setMaterialId] = useState("");
  const [size, setSize] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (open) {
      setMaterialId("");
      setSize("");
      setVariantId("");
      setQuantity("1");
    }
  }, [open]);

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

  const qty = Number(quantity);
  const canSubmit = Boolean(variantId) && Number.isFinite(qty) && qty > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onAdd({ variantId, quantity: qty });
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t("workOrderDetail.line.addTitle")}
      stableHeight
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrderDetail.line.addTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
          {t("workOrderDetail.line.addSubtitle")}
        </Typography>
        {groupsLoading ? (
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.actions.cancel")}</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {t("workOrderDetail.line.addSubmit")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
