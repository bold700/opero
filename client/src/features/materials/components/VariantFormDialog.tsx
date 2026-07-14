import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import {
  createVariant,
  updateVariant,
  type MaterialVariant,
  type VariantInput,
  type MaterialMeta,
} from "../api";

// Create or edit a variant (a purchasable size × component with its price).
// Pass `variant` to edit, omit to create. `materialId` is required to create.
// The size/component/thickness triple must be unique — a 409 surfaces inline.
export function VariantFormDialog({
  open,
  materialId,
  variant,
  meta,
  lang,
  onClose,
  onSaved,
}: {
  open: boolean;
  materialId: string;
  variant?: MaterialVariant | null;
  meta: MaterialMeta | null;
  lang: "nl" | "en";
  onClose: () => void;
  onSaved: (v: MaterialVariant) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(variant);

  const [form, setForm] = useState<VariantInput>({
    size: "",
    component: "meter",
    unit: "m",
    unitPrice: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      variant
        ? {
            size: variant.size,
            component: variant.component,
            thicknessMm: variant.thicknessMm ?? null,
            unit: variant.unit,
            unitPrice: variant.unitPrice ?? 0,
            costPrice: variant.costPrice ?? null,
          }
        : { size: "", component: "meter", unit: "m", unitPrice: 0 },
    );
  }, [open, variant]);

  const label = (o: { nl: string; en: string }) => (lang === "nl" ? o.nl : o.en);
  const set = <K extends keyof VariantInput>(k: K, v: VariantInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSubmit =
    form.size.trim().length > 0 &&
    Number.isFinite(form.unitPrice) &&
    form.unitPrice >= 0 &&
    !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: VariantInput = { ...form, size: form.size.trim() };
      const saved = variant
        ? await updateVariant(variant.id, payload)
        : await createVariant(materialId, payload);
      onSaved(saved);
    } catch (e) {
      // The backend returns 409 with a clear message for the unique constraint.
      setError(e instanceof Error ? e.message : t("materials.variantForm.saveError"));
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={submitting ? undefined : onClose}
      title={editing ? t("materials.variantForm.editTitle") : t("materials.variantForm.createTitle")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {editing ? t("materials.variantForm.editTitle") : t("materials.variantForm.createTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label={t("materials.variantForm.size")}
            value={form.size}
            onChange={(e) => set("size", e.target.value)}
            disabled={submitting}
            size="small"
            required
            autoFocus
          />

          <SelectField
            label={t("materials.variantForm.component")}
            value={form.component}
            onChange={(v) => set("component", v as VariantInput["component"])}
            disabled={submitting || !meta}
            options={(meta?.components ?? []).map((o) => ({ value: o.value, label: label(o) }))}
          />

          <TextField
            label={t("materials.variantForm.thickness")}
            value={form.thicknessMm ?? ""}
            onChange={(e) => set("thicknessMm", e.target.value === "" ? null : Number(e.target.value))}
            disabled={submitting}
            size="small"
            type="number"
            slotProps={{ htmlInput: { min: 0 } }}
          />

          <SelectField
            label={t("materials.variantForm.unit")}
            value={form.unit}
            onChange={(v) => set("unit", v as VariantInput["unit"])}
            disabled={submitting || !meta}
            options={(meta?.units ?? []).map((o) => ({ value: o.value, label: label(o) }))}
          />

          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              label={t("materials.variantForm.unitPrice")}
              value={form.unitPrice}
              onChange={(e) => set("unitPrice", Number(e.target.value))}
              disabled={submitting}
              size="small"
              type="number"
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
            <TextField
              label={t("materials.variantForm.costPrice")}
              value={form.costPrice ?? ""}
              onChange={(e) => set("costPrice", e.target.value === "" ? null : Number(e.target.value))}
              disabled={submitting}
              size="small"
              type="number"
              sx={{ flex: 1 }}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {editing ? t("common.actions.save") : t("materials.variantForm.create")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
