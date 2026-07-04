import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import { useForm } from "../../../lib/useForm";
import { required, nonNegativeNumber } from "../../../lib/validation";
import type { MaterialRow, MaterialInput } from "../api";

type Form = {
  name: string;
  unit: string;
  category: string;
  stock: string;
  minStock: string;
  supplier: string;
};

const EMPTY: Form = {
  name: "",
  unit: "",
  category: "",
  stock: "",
  minStock: "",
  supplier: "",
};

const RULES = {
  name: [required],
  unit: [required],
  stock: [nonNegativeNumber],
  minStock: [nonNegativeNumber],
};

// Create / edit a material (+ its stock). Name & unit required; stock/min-stock
// must be >= 0.
export function MaterialDialog({
  open,
  material,
  categories,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  material?: MaterialRow | null;
  categories: string[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: MaterialInput) => void;
}) {
  const { t } = useTranslation();
  const { values, setField, onBlur, errorFor, isValid, reset, touchAll } = useForm<Form>(
    EMPTY,
    RULES,
  );

  useEffect(() => {
    if (!open) return;
    reset(
      material
        ? {
            name: material.name,
            unit: material.unit,
            category: material.category,
            stock: String(material.stock),
            minStock: String(material.minStock),
            supplier: material.supplier === "—" ? "" : material.supplier,
          }
        : EMPTY,
    );
  }, [open, material, reset]);

  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const handleSave = () => {
    if (!isValid) {
      touchAll();
      return;
    }
    onSubmit({
      name: values.name.trim(),
      unit: values.unit.trim(),
      category: values.category.trim() || undefined,
      stock: values.stock === "" ? undefined : Number(values.stock),
      minStock: values.minStock === "" ? undefined : Number(values.minStock),
      supplier: values.supplier.trim() || undefined,
    });
  };

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" title={material ? t("materials.dialog.editTitle") : t("materials.dialog.newTitle")}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {material ? t("materials.dialog.editTitle") : t("materials.dialog.newTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label={t("materials.dialog.name")}
            value={values.name}
            onChange={setField("name")}
            onBlur={onBlur("name")}
            disabled={busy}
            required
            autoFocus
            size="small"
            {...err("name")}
          />
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
            <TextField
              label={t("materials.dialog.unit")}
              value={values.unit}
              onChange={setField("unit")}
              onBlur={onBlur("unit")}
              disabled={busy}
              required
              size="small"
              sx={{ width: { xs: "100%", sm: 160 } }}
              {...err("unit")}
            />
            <SelectField
              label={t("materials.dialog.category")}
              value={values.category || "other"}
              onChange={(v) => setField("category")({ target: { value: v } })}
              disabled={busy}
              sx={{ flex: 1 }}
              options={categories.map((c) => ({
                value: c,
                label: t(`materials.category.${c}`, { defaultValue: c }),
              }))}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label={t("materials.dialog.stock")}
              value={values.stock}
              onChange={setField("stock")}
              onBlur={onBlur("stock")}
              disabled={busy}
              type="number"
              size="small"
              sx={{ flex: 1 }}
              {...err("stock")}
            />
            <TextField
              label={t("materials.dialog.minStock")}
              value={values.minStock}
              onChange={setField("minStock")}
              onBlur={onBlur("minStock")}
              disabled={busy}
              type="number"
              size="small"
              sx={{ flex: 1 }}
              {...err("minStock")}
            />
          </Box>
          <TextField
            label={t("materials.dialog.supplier")}
            value={values.supplier}
            onChange={setField("supplier")}
            disabled={busy}
            size="small"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !isValid}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
