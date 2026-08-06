import { useEffect, useRef, useState } from "react";
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
import { useDirty } from "../../../lib/isDirty";
import { SelectField } from "../../../components/SelectField";
import {
  createMaterial,
  updateMaterial,
  type MaterialDetail,
  type MaterialInput,
  type MaterialMeta,
  type MaterialSystemCategory,
} from "../api";

// Create or edit a material (the catalog object). One form, two modes: pass a
// `material` to edit, omit it to create. `meta` drives the class / sizeUnit
// dropdowns from the backend's option lists. Provenance is optional metadata.
export function MaterialFormDialog({
  open,
  material,
  meta,
  lang,
  onClose,
  onSaved,
}: {
  open: boolean;
  material?: MaterialDetail | null;
  meta: MaterialMeta | null;
  lang: "nl" | "en";
  onClose: () => void;
  onSaved: (m: MaterialDetail) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(material);

  const [form, setForm] = useState<MaterialInput>({
    name: "",
    class: "insulation",
    category: null,
    supplier: "",
    sizeUnit: "pipe_od_mm",
  });
  // What the dialog was seeded with, so an untouched edit can't be saved.
  const initialForm = useRef<MaterialInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the material each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    const seeded: MaterialInput = material
      ? {
            name: material.name,
            class: material.class,
            category: material.category ?? null,
            supplier: material.supplier ?? "",
            sizeUnit: material.sizeUnit,
            thicknessMm: material.thicknessMm ?? null,
            pipeMaterial: material.pipeMaterial ?? null,
            finish: material.finish ?? null,
            note: material.note ?? null,
            priceSource: material.priceSource ?? null,
            priceValidFrom: material.priceValidFrom ?? null,
            priceValidTo: material.priceValidTo ?? null,
          priceNote: material.priceNote ?? null,
        }
      : { name: "", class: "insulation", category: null, supplier: "", sizeUnit: "pipe_od_mm" };
    initialForm.current = seeded;
    setForm(seeded);
  }, [open, material]);

  const label = (o: { nl: string; en: string }) => (lang === "nl" ? o.nl : o.en);
  const set = <K extends keyof MaterialInput>(k: K, v: MaterialInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dirty = useDirty(form, initialForm.current);
  // Editing additionally requires a change: re-saving an untouched material
  // would PUT the same values back. Creating keeps its original gating, since
  // a new material has nothing to differ from.
  const canSubmit =
    form.name.trim().length > 0 && !submitting && (!editing || dirty);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: MaterialInput = { ...form, name: form.name.trim() };
      const saved = material
        ? await updateMaterial(material.id, payload)
        : await createMaterial(payload);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("materials.form.saveError"));
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={submitting ? undefined : onClose}
      title={editing ? t("materials.form.editTitle") : t("materials.form.createTitle")}
      stableHeight
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {editing ? t("materials.form.editTitle") : t("materials.form.createTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label={t("materials.form.name")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={submitting}
            size="small"
            required
            autoFocus
          />

          <SelectField
            label={t("materials.form.class")}
            value={form.class}
            onChange={(v) => set("class", v as MaterialInput["class"])}
            disabled={submitting || !meta}
            options={(meta?.classes ?? []).map((o) => ({ value: o.value, label: label(o) }))}
          />

          {/* Installation system (GKW / CV / ...) — the axis technicians search
              on. Optional: "" maps to null, for a material used across systems. */}
          <SelectField
            label={t("materials.form.category")}
            value={form.category ?? ""}
            onChange={(v) =>
              set("category", v === "" ? null : (v as MaterialSystemCategory))
            }
            disabled={submitting || !meta}
            options={[
              { value: "", label: t("materials.form.categoryNone") },
              ...(meta?.categories ?? []).map((o) => ({ value: o.value, label: label(o) })),
            ]}
          />

          <TextField
            label={t("materials.form.supplier")}
            value={form.supplier ?? ""}
            onChange={(e) => set("supplier", e.target.value)}
            disabled={submitting}
            size="small"
          />

          <SelectField
            label={t("materials.form.sizeUnit")}
            value={form.sizeUnit}
            onChange={(v) => set("sizeUnit", v as MaterialInput["sizeUnit"])}
            disabled={submitting || !meta}
            options={(meta?.sizeUnits ?? []).map((o) => ({ value: o.value, label: label(o) }))}
          />

          <TextField
            label={t("materials.form.thickness")}
            value={form.thicknessMm ?? ""}
            onChange={(e) => set("thicknessMm", e.target.value === "" ? null : Number(e.target.value))}
            disabled={submitting}
            size="small"
            type="number"
            slotProps={{ htmlInput: { min: 0 } }}
          />

          <TextField
            label={t("materials.form.note")}
            value={form.note ?? ""}
            onChange={(e) => set("note", e.target.value || null)}
            disabled={submitting}
            size="small"
            multiline
            minRows={1}
          />
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
          {editing ? t("common.actions.save") : t("materials.form.create")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
