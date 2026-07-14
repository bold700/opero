import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PageLayout } from "../../components/PageLayout";
import { StatusBadge } from "../../components/StatusBadge";
import { ResponsiveList } from "../../components/ResponsiveList";
import { STATUS_TONES, SPACING } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { getMaterial, type MaterialVariant } from "./api";
import {
  CLASS_LABEL_KEYS,
  COMPONENT_LABEL_KEYS,
  FINISH_LABEL_KEYS,
  PIPE_MATERIAL_LABEL_KEYS,
  SIZE_UNIT_LABEL_KEYS,
  formatPrice,
} from "./constants";

// Compact date for provenance display (nl-NL, the app's locale default).
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL");
}

// Material detail — one material's attributes, price provenance and its full
// variant table (size · component · price).
export function MaterialDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const { data: material, loading, error } = useApi(
    () => getMaterial(id),
    [id],
  );

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

  const validity =
    material.priceValidFrom && material.priceValidTo
      ? t("materials.detail.validRange", {
          from: formatDate(material.priceValidFrom),
          to: formatDate(material.priceValidTo),
        })
      : material.priceValidFrom
        ? t("materials.detail.validFrom", { from: formatDate(material.priceValidFrom) })
        : null;

  const componentLabel = (v: MaterialVariant) =>
    v.thicknessMm != null
      ? `${t(COMPONENT_LABEL_KEYS[v.component])} ${v.thicknessMm} mm`
      : t(COMPONENT_LABEL_KEYS[v.component]);

  return (
    <PageLayout title={t("materials.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        {/* Header: back + name + meta badges + provenance */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <IconButton
            aria-label={t("materials.detail.back")}
            onClick={() => navigate("/materials")}
            sx={{ mt: -0.5, ml: -1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {material.name}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <StatusBadge label={t(CLASS_LABEL_KEYS[material.class])} tone={STATUS_TONES.open} />
              <StatusBadge label={material.supplier} tone={STATUS_TONES.neutral} />
              {material.thicknessMm != null ? (
                <StatusBadge
                  label={t("materials.detail.thickness", { mm: material.thicknessMm })}
                  tone={STATUS_TONES.info}
                />
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
            {(material.priceSource || validity || material.priceNote || material.note) && (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {[
                  material.priceSource
                    ? t("materials.detail.priceSource", { source: material.priceSource })
                    : null,
                  validity,
                  material.priceNote,
                  material.note,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Variant table: size · component · price */}
        <ResponsiveList<MaterialVariant>
          items={material.variants}
          keyOf={(v) => v.id}
          empty={t("materials.empty")}
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
                  {v.unitPrice != null ? `${formatPrice(v.unitPrice)} / ${v.unit}` : "—"}
                </Typography>
              ),
            },
          ]}
          renderCard={(v) => (
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {v.size} · {componentLabel(v)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                {v.unitPrice != null ? `${formatPrice(v.unitPrice)} / ${v.unit}` : "—"}
              </Typography>
            </Box>
          )}
        />
      </Box>
    </PageLayout>
  );
}
