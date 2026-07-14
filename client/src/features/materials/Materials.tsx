import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER, SPACING } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import {
  getMaterialGroups,
  getSuppliers,
  searchVariants,
  type MaterialVariantRow,
} from "./api";
import { MaterialsActions } from "./components/MaterialsActions";
import { MaterialGroupList } from "./components/MaterialGroupList";
import { VariantSearchTable } from "./components/VariantSearchTable";

// Materials — the company's catalog of real products (28 materials), grouped
// by class (insulation / fittings / tanks / cladding). Tap a material → its
// detail page with all sizes/prices. Typing a search term switches to a FLAT
// list of matching variants (search = find a price fast; grouping = browse).
export function Materials() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState<string>(""); // "" = all suppliers
  const debouncedSearch = useDebounced(search, 300);
  const searching = debouncedSearch.trim().length > 0;

  const { data: suppliers } = useApi(getSuppliers, []);
  const { data: groups, loading: groupsLoading, error: groupsError } = useApi(
    getMaterialGroups,
    [],
  );

  // Flat variant search — only active while a term is entered.
  const {
    items: variantRows,
    loading: searchLoading,
    loadingMore,
    error: searchError,
    hasMore,
    loadMore,
  } = usePagedApi<MaterialVariantRow>(
    (cursor) =>
      searching
        ? searchVariants({
            cursor,
            search: debouncedSearch,
            supplier: supplier || undefined,
          })
        : Promise.resolve({ items: [], nextCursor: null }),
    [debouncedSearch, supplier, searching],
  );

  const visibleGroups = (groups ?? [])
    .map((g) => ({
      ...g,
      materials: supplier
        ? g.materials.filter((m) => m.supplier === supplier)
        : g.materials,
    }))
    .filter((g) => g.materials.length > 0);

  const loading = searching ? searchLoading : groupsLoading;
  const error = searching ? searchError : groupsError;

  return (
    <PageLayout
      title={t("materials.title")}
      actions={<MaterialsActions search={search} onSearch={setSearch} />}
    >
      {/* Supplier filter chips (only when there's more than one supplier). */}
      {suppliers && suppliers.length > 1 ? (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <FilterChip
            label={t("materials.filters.allSuppliers")}
            active={supplier === ""}
            onClick={() => setSupplier("")}
          />
          {suppliers.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={supplier === s}
              onClick={() => setSupplier(s)}
            />
          ))}
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : searching ? (
        <VariantSearchTable
          rows={variantRows}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      ) : visibleGroups.length === 0 ? (
        <Alert severity="info">{t("materials.empty")}</Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
          {visibleGroups.map((group) => (
            <MaterialGroupList
              key={group.class}
              group={group}
              onOpen={(id) => navigate(`/materials/${id}`)}
            />
          ))}
        </Box>
      )}
    </PageLayout>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Chip
      label={label}
      onClick={onClick}
      variant={active ? "filled" : "outlined"}
      sx={
        active
          ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 }
          : { color: "text.secondary" }
      }
    />
  );
}
