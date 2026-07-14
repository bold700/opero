import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { CLASS_LABEL_KEYS, formatSizeRange } from "../constants";
import type { MaterialGroup, MaterialSummary } from "../api";

// One class section of the catalog: a heading (Isolatie / Hulpstukken /
// Buffervaten / Plaatwerk) and its materials as the standard table→card list.
// Tapping a material opens its detail page.
export function MaterialGroupList({
  group,
  onOpen,
}: {
  group: MaterialGroup;
  onOpen: (materialId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t(CLASS_LABEL_KEYS[group.class])}
        <Typography component="span" variant="body2" sx={{ color: "text.secondary", ml: 1 }}>
          {group.materials.length}
        </Typography>
      </Typography>

      <ResponsiveList<MaterialSummary>
        items={group.materials}
        keyOf={(m) => m.id}
        empty={t("materials.empty")}
        onRowClick={(m) => onOpen(m.id)}
        columns={[
          {
            header: t("materials.columns.name"),
            cell: (m) => (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {m.name}
              </Typography>
            ),
          },
          {
            header: t("materials.columns.supplier"),
            cell: (m) => (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {m.supplier}
              </Typography>
            ),
          },
          {
            header: t("materials.columns.sizeRange"),
            cell: (m) => (
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                {formatSizeRange(m.sizeUnit, m.sizeRange)}
              </Typography>
            ),
          },
          {
            header: t("materials.columns.variantCount"),
            align: "right",
            cell: (m) => (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="body2">{m.variantCount}</Typography>
                <ChevronRightIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </Box>
            ),
          },
        ]}
        renderCard={(m) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {m.name}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {m.supplier} · {formatSizeRange(m.sizeUnit, m.sizeRange)} ·{" "}
                {t("materials.detail.priceCount", { count: m.variantCount })}
              </Typography>
            </Box>
            <ChevronRightIcon fontSize="small" sx={{ color: "text.secondary" }} />
          </Box>
        )}
      />
    </Box>
  );
}
