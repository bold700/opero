import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import { useForm } from "../../../lib/useForm";
import { required, nonNegativeNumber } from "../../../lib/validation";
import type { MaterialRow, MaterialInput, Category } from "../api";
import { useIsMobile } from "../../../lib/useIsMobile";

// Sentinel option: picking it switches the category field to an inline "new
// category" text input (creatable-select pattern), no nested dialog.
const NEW_CATEGORY = "__new_category__";

type Form = {
  name: string;
  unit: string;
  category: string;
  price: string;
  stock: string;
  minStock: string;
  supplier: string;
};

const EMPTY: Form = {
  name: "",
  unit: "",
  category: "",
  price: "",
  stock: "",
  minStock: "",
  supplier: "",
};

const RULES = {
  name: [required],
  unit: [required],
  price: [nonNegativeNumber],
  stock: [nonNegativeNumber],
  minStock: [nonNegativeNumber],
};

// Create / edit a material (+ its stock). Name & unit required; stock/min-stock
// must be >= 0.
export function MaterialDialog({
  open,
  material,
  categories,
  canManage,
  busy,
  error,
  onClose,
  onSubmit,
  onCreateCategory,
}: {
  open: boolean;
  material?: MaterialRow | null;
  categories: Category[];
  /** Admins may create a new category inline. */
  canManage: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: MaterialInput) => void;
  /** Create a category, returning its name (which becomes the selected value). */
  onCreateCategory: (name: string) => Promise<string>;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { values, setField, onBlur, errorFor, isValid, reset, touchAll } = useForm<Form>(
    EMPTY,
    RULES,
  );

  // Inline "new category" state (the creatable-select branch).
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatError, setNewCatError] = useState<string | null>(null);

  const confirmNewCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    setNewCatError(null);
    try {
      const created = await onCreateCategory(name);
      setField("category")({ target: { value: created } });
      setNewCatMode(false);
      setNewCatName("");
    } catch (e) {
      setNewCatError(e instanceof Error ? e.message : t("materials.categoryManager.createError"));
    } finally {
      setCreatingCat(false);
    }
  };

  const cancelNewCategory = () => {
    setNewCatMode(false);
    setNewCatName("");
    setNewCatError(null);
  };

  useEffect(() => {
    if (!open) return;
    // Reset the inline-category branch whenever the dialog (re)opens.
    setNewCatMode(false);
    setNewCatName("");
    setNewCatError(null);
    reset(
      material
        ? {
            name: material.name,
            unit: material.unit,
            category: material.category,
            price: material.unitPrice != null ? String(material.unitPrice) : "",
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
      unitPrice: values.price === "" ? undefined : Number(values.price),
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
            autoFocus={!isMobile}
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
            {newCatMode ? (
              // Inline "new category" input (creatable-select branch): a text
              // field + confirm/cancel, right here — no nested dialog.
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-start" }}>
                  <TextField
                    label={t("materials.categoryManager.newName")}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void confirmNewCategory();
                      } else if (e.key === "Escape") {
                        cancelNewCategory();
                      }
                    }}
                    disabled={busy || creatingCat}
                    size="small"
                    autoFocus
                    fullWidth
                    error={!!newCatError}
                    helperText={newCatError ?? undefined}
                  />
                  <IconButton
                    size="small"
                    aria-label={t("common.actions.confirm")}
                    onClick={() => void confirmNewCategory()}
                    disabled={busy || creatingCat || !newCatName.trim()}
                    color="primary"
                  >
                    {creatingCat ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t("common.actions.cancel")}
                    onClick={cancelNewCategory}
                    disabled={busy || creatingCat}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ) : (
              <SelectField
                label={t("materials.dialog.category")}
                value={values.category || "other"}
                onChange={(v) => {
                  if (v === NEW_CATEGORY) {
                    setNewCatMode(true);
                    setNewCatName("");
                    setNewCatError(null);
                    return;
                  }
                  setField("category")({ target: { value: v } });
                }}
                disabled={busy}
                sx={{ flex: 1 }}
                options={[
                  ...categories.map((c) => ({
                    value: c.name,
                    label: t(`materials.category.${c.name}`, { defaultValue: c.name }),
                  })),
                  ...(canManage
                    ? [{ value: NEW_CATEGORY, label: t("materials.categoryManager.addNew"), emphasize: true }]
                    : []),
                ]}
              />
            )}
          </Box>
          <TextField
            label={t("materials.dialog.unitPrice")}
            value={values.price}
            onChange={setField("price")}
            onBlur={onBlur("price")}
            disabled={busy}
            type="number"
            size="small"
            sx={{ width: { xs: "100%", sm: 200 } }}
            slotProps={{
              input: {
                startAdornment: <Box sx={{ mr: 0.5, color: "text.secondary" }}>€</Box>,
              },
            }}
            {...err("price")}
          />
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
