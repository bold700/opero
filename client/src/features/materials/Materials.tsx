import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { getMaterials, type MaterialRow } from "./api";
import { FILTERS, FILTER_LABEL_KEYS, type MaterialFilter } from "./constants";
import { MaterialsActions } from "./components/MaterialsActions";
import { MaterialsKpis } from "./components/MaterialsKpis";
import { MaterialsTable } from "./components/MaterialsTable";

export function Materials() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<MaterialFilter>("all");
  const { data, loading, error } = useApi<MaterialRow[]>(getMaterials);

  const rows = data ?? [];

  const kpis = useMemo(
    () => [
      { label: t("materials.kpis.totalItems"), value: rows.length, tone: "#6750A4" },
      { label: t("materials.kpis.low"), value: rows.filter((r) => r.status === "low").length, tone: "#B3261E" },
      { label: t("materials.kpis.outOfStock"), value: rows.filter((r) => r.status === "out_of_stock").length, tone: "#B3261E" },
      { label: t("materials.kpis.stockOk"), value: rows.filter((r) => r.status === "ok").length, tone: "#1E8E5A" },
    ],
    [rows, t],
  );

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case "ok":
        return rows.filter((r) => r.status === "ok");
      case "low":
        return rows.filter((r) => r.status === "low");
      case "out_of_stock":
        return rows.filter((r) => r.status === "out_of_stock");
      default:
        return rows;
    }
  }, [rows, activeFilter]);

  return (
    <PageLayout title={t("materials.title")} actions={<MaterialsActions />}>
      <MaterialsKpis kpis={kpis} />

      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f === activeFilter;
          return (
            <Chip
              key={f}
              label={t(FILTER_LABEL_KEYS[f])}
              onClick={() => setActiveFilter(f)}
              variant={active ? "filled" : "outlined"}
              sx={active ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 } : { color: "text.secondary" }}
            />
          );
        })}
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <MaterialsTable rows={filtered} />
      )}
    </PageLayout>
  );
}
