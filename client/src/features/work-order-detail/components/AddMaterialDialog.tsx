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

// Cascading picker over the materials catalog: material (grouped by class) →
// size/Ø → component (variant) → quantity. Submits only the chosen variant id
// + quantity — name/unit/unitPrice resolve SERVER-side (a technician's own
// responses have prices stripped, so the price shown here is display only,
// never the source of truth).
export function AddMaterialDialog({
  open,
  busy,
  onClose,
  onAdd,
}: {
  open: boolean;
  busy: boolean;
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

  // Reset the cascade each time the dialog opens.
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

  // Materials in one select, grouped by class via label prefixes.
  const materialOptions: SelectOption[] = (groups ?? []).flatMap((g) =>
    g.materials.map((m) => ({
      value: m.id,
      label: `${t(CLASS_LABEL_KEYS[g.class])} — ${m.name}`,
    })),
  );

  // Distinct sizes in source order; the chosen size's variants become the
  // component options (one option per priced variant, incl. thickness columns).
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
    // Price is display-only here and stripped for technicians.
    return v.unitPrice != null ? `${base} — ${formatPrice(v.unitPrice)}` : base;
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
      title={t("workOrderDetail.addMaterialDialog.title")}
      stableHeight
    >
      <DialogTitle>{t("workOrderDetail.addMaterialDialog.title")}</DialogTitle>
      <DialogContent>
        {groupsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <SelectField
              label={t("workOrderDetail.addMaterialDialog.material")}
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
                label={t("workOrderDetail.addMaterialDialog.component")}
                value={variantId}
                onChange={setVariantId}
                options={variantOptions}
                fullWidth
              />
            ) : null}
            {variantId ? (
              <TextField
                label={t("workOrderDetail.addMaterialDialog.quantity")}
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
          {t("workOrderDetail.addMaterialDialog.add")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
