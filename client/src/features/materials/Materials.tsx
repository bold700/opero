import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { PageLayout } from "../../components/PageLayout";
import { FilterSelect } from "../../components/FilterSelect";
import { SPACING } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useAuth } from "../../auth/AuthContext";
import { canSeePrices, isOffice, type UserRole } from "@opero/shared";
import {
  getMaterialGroups,
  getSuppliers,
  getMaterialMeta,
  searchVariants,
  type MaterialSystemCategory,
  type MaterialVariantRow,
} from "./api";
import { CATEGORY_ORDER, CATEGORY_LABEL_KEYS } from "./constants";
import { MaterialsActions } from "./components/MaterialsActions";
import { MaterialGroupList } from "./components/MaterialGroupList";
import { VariantSearchTable } from "./components/VariantSearchTable";
import { MaterialFormDialog } from "./components/MaterialFormDialog";
import { ArticlesSection } from "./components/ArticlesSection";

// Materials — the company's catalog of real products (28 materials), grouped
// by class (insulation / fittings / tanks / cladding). Tap a material → its
// detail page with all sizes/prices. Typing a search term switches to a FLAT
// list of matching variants (search = find a price fast; grouping = browse).
export function Materials() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isOffice(user?.role ?? "client");
  // Least-privileged fallback: canSeePrices("client") is TRUE, so defaulting to
  // "client" like isAdmin does above would show prices to an unresolved user.
  const role: UserRole = user?.role ?? "technician";
  const showPrices = canSeePrices(role);
  const lang = i18n.language.startsWith("en") ? "en" : "nl";

  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState<string>(""); // "" = all suppliers
  // "" = all systems; narrows server-side so uncategorised materials only
  // appear under the "all" default (mirrors the technician picker's filter).
  const [category, setCategory] = useState<MaterialSystemCategory | "">("");
  // Which catalog: the material catalog, or the article list (products &
  // services). One page, two views — same FilterSelect the list pages use.
  const [view, setView] = useState<"materials" | "articles">("materials");
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // bump to refetch groups
  const debouncedSearch = useDebounced(search, 300);
  const searching = debouncedSearch.trim().length > 0;

  const { data: suppliers } = useApi(getSuppliers, [reloadKey]);
  const { data: meta } = useApi(() => (isAdmin ? getMaterialMeta() : Promise.resolve(null)), [isAdmin]);
  const { data: groups, loading: groupsLoading, error: groupsError } = useApi(
    () => getMaterialGroups(category || undefined),
    [reloadKey, category],
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
            category: category || undefined,
          })
        : Promise.resolve({ items: [], nextCursor: null }),
    [debouncedSearch, supplier, category, searching],
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
      actions={
        view === "materials" ? (
          <MaterialsActions
            search={search}
            onSearch={setSearch}
            canCreate={isAdmin}
            onCreate={() => setCreateOpen(true)}
          />
        ) : undefined
      }
    >
      {/* View + system + supplier filters (supplier only when there's more than one). */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <FilterSelect
          value={view}
          onChange={(v) => setView(v as "materials" | "articles")}
          ariaLabel={t("materials.view.label")}
          options={[
            { value: "materials", label: t("materials.view.materials") },
            { value: "articles", label: t("materials.view.articles") },
          ]}
        />
        {view === "materials" ? (
          <>
        <FilterSelect
          value={category}
          onChange={(v) => setCategory(v as MaterialSystemCategory | "")}
          ariaLabel={t("materials.filters.label")}
          options={[
            { value: "", label: t("materials.filters.allCategories") },
            ...CATEGORY_ORDER.map((c) => ({ value: c, label: t(CATEGORY_LABEL_KEYS[c]) })),
          ]}
        />
        {suppliers && suppliers.length > 1 ? (
          <FilterSelect
            value={supplier}
            onChange={setSupplier}
            ariaLabel={t("materials.filters.label")}
            options={[
              { value: "", label: t("materials.filters.allSuppliers") },
              ...suppliers.map((s) => ({ value: s, label: s })),
            ]}
          />
        ) : null}
          </>
        ) : null}
      </Box>

      {view === "articles" ? (
        <ArticlesSection canManage={isAdmin} showPrices={showPrices} />
      ) : loading ? (
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
          showPrices={showPrices}
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
              showPrices={showPrices}
            />
          ))}
        </Box>
      )}

      {isAdmin ? (
        <MaterialFormDialog
          open={createOpen}
          meta={meta ?? null}
          lang={lang}
          onClose={() => setCreateOpen(false)}
          onSaved={(m) => {
            setCreateOpen(false);
            // Straight to the new material so the admin can add variants.
            navigate(`/materials/${m.id}`);
          }}
        />
      ) : null}
    </PageLayout>
  );
}
