import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { PageLayout } from "../../components/PageLayout";
import { MaterialDetailActions } from "./components/MaterialDetailActions";
import { StatusBadge } from "../../components/StatusBadge";
import { ResponsiveList } from "../../components/ResponsiveList";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { STATUS_TONES, SPACING } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { useAuth } from "../../auth/AuthContext";
import { isOffice } from "@opero/shared";
import {
  getMaterial,
  getMaterialMeta,
  deleteMaterial,
  deleteVariant,
  type MaterialDetail as MaterialDetailType,
  type MaterialVariant,
} from "./api";
import { MaterialFormDialog } from "./components/MaterialFormDialog";
import { VariantFormDialog } from "./components/VariantFormDialog";
import {
  CLASS_LABEL_KEYS,
  COMPONENT_LABEL_KEYS,
  FINISH_LABEL_KEYS,
  PIPE_MATERIAL_LABEL_KEYS,
  SIZE_UNIT_LABEL_KEYS,
  UNIT_LABEL_KEYS,
  formatPrice,
} from "./constants";

// Material detail — one material's attributes and its full variant table.
// Admins can edit/delete the material and create/edit/delete its variants; the
// catalog is user-managed (the seed only bootstraps it).
export function MaterialDetail() {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isOffice(user?.role ?? "client");
  const lang = i18n.language.startsWith("en") ? "en" : "nl";

  const [material, setMaterial] = useState<MaterialDetailType | null>(null);
  const { loading, error } = useApi(
    async () => {
      const m = await getMaterial(id);
      setMaterial(m);
      return m;
    },
    [id],
  );
  const { data: meta } = useApi(() => (isAdmin ? getMaterialMeta() : Promise.resolve(null)), [isAdmin]);

  // Dialog + confirm state.
  const [editMaterialOpen, setEditMaterialOpen] = useState(false);
  const [deleteMaterialOpen, setDeleteMaterialOpen] = useState(false);
  const [variantDialog, setVariantDialog] = useState<{ open: boolean; variant: MaterialVariant | null }>({
    open: false,
    variant: null,
  });
  const [deleteVariantTarget, setDeleteVariantTarget] = useState<MaterialVariant | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Variant search. The whole variant set is already loaded with the material,
  // so this filters in memory (no refetch) over the fields shown in the row:
  // size, component label and thickness.
  const [variantSearch, setVariantSearch] = useState("");
  const allVariants = material?.variants ?? [];
  const q = variantSearch.trim().toLowerCase();
  const variants = q
    ? allVariants.filter((v) =>
        [v.size, t(COMPONENT_LABEL_KEYS[v.component]), v.thicknessMm != null ? `${v.thicknessMm} mm` : ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : allVariants;

  if (loading) {
    return (
      <PageLayout title={t("materials.title")}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }
  if (error || !material) {
    return (
      <PageLayout title={t("materials.title")}>
        <Alert severity="error">{error ?? t("materials.empty")}</Alert>
      </PageLayout>
    );
  }

  const componentLabel = (v: MaterialVariant) =>
    v.thicknessMm != null
      ? `${t(COMPONENT_LABEL_KEYS[v.component])} ${v.thicknessMm} mm`
      : t(COMPONENT_LABEL_KEYS[v.component]);

  const priceLabel = (v: MaterialVariant) =>
    v.unitPrice != null
      ? `${formatPrice(v.unitPrice)} / ${t(UNIT_LABEL_KEYS[v.unit] ?? v.unit)}`
      : "—";

  const marginLabel = (v: MaterialVariant) =>
    v.unitPrice != null && v.costPrice != null
      ? `${formatPrice(v.costPrice)} · ${t("materials.columns.marginShort", { amount: formatPrice(v.unitPrice - v.costPrice) })}`
      : v.costPrice != null
        ? formatPrice(v.costPrice)
        : "—";

  // After any variant create/edit, merge it into local state (no full refetch).
  const onVariantSaved = (saved: MaterialVariant) => {
    setMaterial((m) =>
      m
        ? {
            ...m,
            variants: m.variants.some((v) => v.id === saved.id)
              ? m.variants.map((v) => (v.id === saved.id ? { ...v, ...saved } : v))
              : [...m.variants, saved],
          }
        : m,
    );
    setVariantDialog({ open: false, variant: null });
  };

  const runDeleteVariant = async (force: boolean) => {
    if (!deleteVariantTarget) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteVariant(deleteVariantTarget.id, force);
      setMaterial((m) =>
        m ? { ...m, variants: m.variants.filter((v) => v.id !== deleteVariantTarget.id) } : m,
      );
      setDeleteVariantTarget(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("materials.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  const runDeleteMaterial = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteMaterial(material.id);
      navigate("/materials");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("materials.deleteError"));
      setBusy(false);
    }
  };

  return (
    <PageLayout
      title={t("materials.title")}
      actions={
        <MaterialDetailActions
          search={variantSearch}
          onSearch={setVariantSearch}
          canCreate={isAdmin}
          onCreate={() => setVariantDialog({ open: true, variant: null })}
        />
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        {actionError ? <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert> : null}

        {/* Header: back + name + meta badges + (admin) edit/delete */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <IconButton
            aria-label={t("materials.detail.back")}
            onClick={() => navigate("/materials")}
            sx={{ mt: -0.5, ml: -1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {material.name}
            </Typography>
            {/* The product's SPEC — read-only facts about the thing you're
                looking at, not controls. All one flat neutral tone: a coloured
                pill here reads as "selected/clickable" (STATUS_TONES.open is
                literally the active-filter-chip lavender), and there is nothing
                to click.
                No thickness badge: it's already in the name of every material
                that has one ("AF/Armaflex AF/2 13 mm"), so repeating it a line
                below the title just competed with the variant list's pipe-Ø
                column — two different mm figures, read as a contradiction. */}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <StatusBadge label={t(CLASS_LABEL_KEYS[material.class])} tone={STATUS_TONES.neutral} />
              {material.supplier ? (
                <StatusBadge label={material.supplier} tone={STATUS_TONES.neutral} />
              ) : null}
              {material.finish ? (
                <StatusBadge label={t(FINISH_LABEL_KEYS[material.finish])} tone={STATUS_TONES.neutral} />
              ) : null}
              {material.pipeMaterial ? (
                <StatusBadge
                  label={t(PIPE_MATERIAL_LABEL_KEYS[material.pipeMaterial])}
                  tone={STATUS_TONES.neutral}
                />
              ) : null}
            </Box>
            {material.note && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {material.note}
              </Typography>
            )}
          </Box>
          {isAdmin ? (
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
              <IconButton
                aria-label={t("materials.form.editTitle")}
                onClick={() => setEditMaterialOpen(true)}
                disabled={busy}
              >
                <EditOutlinedIcon />
              </IconButton>
              <IconButton
                aria-label={t("materials.detail.deleteMaterial")}
                onClick={() => setDeleteMaterialOpen(true)}
                disabled={busy}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          ) : null}
        </Box>

        {/* Variant table */}
        <ResponsiveList<MaterialVariant>
          items={variants}
          keyOf={(v) => v.id}
          empty={q ? t("materials.detail.noMatches") : t("materials.empty")}
          columns={[
            {
              header: t(SIZE_UNIT_LABEL_KEYS[material.sizeUnit]),
              cell: (v) => (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {v.size}
                </Typography>
              ),
            },
            {
              header: t("materials.columns.component"),
              cell: (v) => <Typography variant="body2">{componentLabel(v)}</Typography>,
            },
            {
              header: t("materials.columns.price"),
              align: "right",
              cell: (v) => (
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                  {priceLabel(v)}
                </Typography>
              ),
            },
            // Admin-only: cost + margin (read display; edit via the row action).
            ...(isAdmin
              ? [
                  {
                    header: t("materials.columns.cost"),
                    align: "right" as const,
                    cell: (v: MaterialVariant) => (
                      <Typography variant="body2" sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
                        {marginLabel(v)}
                      </Typography>
                    ),
                  },
                  {
                    header: "",
                    align: "right" as const,
                    cell: (v: MaterialVariant) => (
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                        <IconButton
                          size="small"
                          aria-label={t("materials.variantForm.editTitle")}
                          onClick={() => setVariantDialog({ open: true, variant: v })}
                          disabled={busy}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={t("materials.variantForm.delete")}
                          onClick={() => setDeleteVariantTarget(v)}
                          disabled={busy}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ),
                  },
                ]
              : []),
          ]}
          renderCard={(v) => (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {v.size} · {componentLabel(v)}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                  {priceLabel(v)}
                </Typography>
              </Box>
              {isAdmin ? (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {marginLabel(v)}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton
                      size="small"
                      aria-label={t("materials.variantForm.editTitle")}
                      onClick={() => setVariantDialog({ open: true, variant: v })}
                      disabled={busy}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t("materials.variantForm.delete")}
                      onClick={() => setDeleteVariantTarget(v)}
                      disabled={busy}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : null}
            </Box>
          )}
        />

      </Box>

      {/* Dialogs (admin only) */}
      {isAdmin ? (
        <>
          <MaterialFormDialog
            open={editMaterialOpen}
            material={material}
            meta={meta ?? null}
            lang={lang}
            onClose={() => setEditMaterialOpen(false)}
            onSaved={(m) => {
              setMaterial((prev) => (prev ? { ...prev, ...m } : m));
              setEditMaterialOpen(false);
            }}
          />

          <VariantFormDialog
            open={variantDialog.open}
            materialId={material.id}
            variant={variantDialog.variant}
            meta={meta ?? null}
            lang={lang}
            onClose={() => setVariantDialog({ open: false, variant: null })}
            onSaved={onVariantSaved}
          />

          <ConfirmDialog
            open={deleteMaterialOpen}
            title={t("materials.detail.deleteMaterialTitle")}
            body={t("materials.detail.deleteMaterialMessage", { name: material.name })}
            confirmLabel={t("common.actions.delete")}
            destructive
            busy={busy}
            onClose={() => setDeleteMaterialOpen(false)}
            onConfirm={runDeleteMaterial}
          />

          <ConfirmDialog
            open={deleteVariantTarget !== null}
            title={t("materials.variantForm.deleteTitle")}
            body={t("materials.variantForm.deleteMessage")}
            confirmLabel={t("common.actions.delete")}
            destructive
            busy={busy}
            onClose={() => setDeleteVariantTarget(null)}
            onConfirm={() => runDeleteVariant(false)}
          />
        </>
      ) : null}
    </PageLayout>
  );
}
