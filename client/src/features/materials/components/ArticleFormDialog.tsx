import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import type { Article, ArticleCategory, ArticleInput } from "../api";

const CATEGORIES: ArticleCategory[] = ["labor", "material", "insulation", "logistics"];

// Create / edit an article (a product or service in the flat price list —
// labour hours, logistics, miscellaneous sales items). Pass `article` to edit.
export function ArticleFormDialog({
  open,
  article,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  article?: Article | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: ArticleInput) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(article);

  const [category, setCategory] = useState<ArticleCategory>("labor");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("uur");
  const [unitPrice, setUnitPrice] = useState("");
  const [defaultQuantity, setDefaultQuantity] = useState("1");

  useEffect(() => {
    if (!open) return;
    setCategory(article?.category ?? "labor");
    setName(article?.name ?? "");
    setUnit(article?.unit ?? "uur");
    setUnitPrice(article?.unitPrice != null ? String(article.unitPrice) : "");
    setDefaultQuantity(String(article?.defaultQuantity ?? 1));
  }, [open, article]);

  const price = Number(unitPrice.trim().replace(",", "."));
  const qty = Number(defaultQuantity.trim().replace(",", "."));
  const canSubmit =
    !busy &&
    name.trim().length > 0 &&
    unit.trim().length > 0 &&
    Number.isFinite(price) &&
    price >= 0 &&
    Number.isFinite(qty) &&
    qty >= 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      category,
      name: name.trim(),
      unit: unit.trim(),
      unitPrice: price,
      defaultQuantity: qty,
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      title={editing ? t("materials.articles.editTitle") : t("materials.articles.newTitle")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {editing ? t("materials.articles.editTitle") : t("materials.articles.newTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <SelectField
            label={t("materials.articles.category")}
            value={category}
            onChange={(v) => setCategory(v as ArticleCategory)}
            disabled={busy}
            options={CATEGORIES.map((c) => ({
              value: c,
              label: t(`materials.articles.categories.${c}`),
            }))}
          />
          <TextField
            label={t("materials.articles.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
            size="small"
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label={t("materials.articles.unit")}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label={t("materials.articles.unitPrice")}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              disabled={busy}
              size="small"
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
              sx={{ flex: 1 }}
            />
          </Box>
          <TextField
            label={t("materials.articles.defaultQuantity")}
            value={defaultQuantity}
            onChange={(e) => setDefaultQuantity(e.target.value)}
            disabled={busy}
            size="small"
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
            sx={{ width: 180 }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
