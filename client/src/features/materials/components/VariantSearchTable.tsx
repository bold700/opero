import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { formatPrice } from "../constants";
import type { MaterialVariantRow } from "../api";

// Flat search results: one row per matching variant (search mode of the
// Materials screen). Price shown when present (stripped server-side for
// technicians).
export function VariantSearchTable({
  rows,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: MaterialVariantRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation();

  const price = (r: MaterialVariantRow) =>
    r.unitPrice != null ? `${formatPrice(r.unitPrice)} / ${r.unit}` : "—";

  return (
    <ResponsiveList<MaterialVariantRow>
      items={rows}
      keyOf={(r) => r.id}
      empty={t("materials.empty")}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      columns={[
        {
          header: t("materials.columns.name"),
          cell: (r) => (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {r.name}
            </Typography>
          ),
        },
        {
          header: t("materials.columns.supplier"),
          cell: (r) => (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {r.supplier}
            </Typography>
          ),
        },
        {
          header: t("materials.columns.price"),
          align: "right",
          cell: (r) => (
            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
              {price(r)}
            </Typography>
          ),
        },
      ]}
      renderCard={(r) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {r.name}
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {r.supplier}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
              {price(r)}
            </Typography>
          </Box>
        </Box>
      )}
    />
  );
}
