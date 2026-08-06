import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { formatPrice, UNIT_LABEL_KEYS } from "../constants";
import type { MaterialVariantRow } from "../api";

// Flat search results: one row per matching variant (search mode of the
// Materials screen).
//
// `showPrices` (canSeePrices, from the page) removes the price COLUMN entirely
// for field staff rather than blanking its cells. The backend already strips the
// value, so a rendered column would show a dash per row — which still tells a
// monteur these parts are priced. Field staff keep the catalog; the money is not
// theirs to see.
export function VariantSearchTable({
  rows,
  hasMore,
  loadingMore,
  onLoadMore,
  showPrices,
}: {
  rows: MaterialVariantRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  showPrices: boolean;
}) {
  const { t } = useTranslation();

  const price = (r: MaterialVariantRow) =>
    r.unitPrice != null
      ? `${formatPrice(r.unitPrice)} / ${t(UNIT_LABEL_KEYS[r.unit] ?? r.unit)}`
      : "—";

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
        ...(showPrices
          ? [
              {
                header: t("materials.columns.price"),
                align: "right" as const,
                cell: (r: MaterialVariantRow) => (
                  <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                    {price(r)}
                  </Typography>
                ),
              },
            ]
          : []),
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
            {showPrices ? (
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                {price(r)}
              </Typography>
            ) : null}
          </Box>
        </Box>
      )}
    />
  );
}
