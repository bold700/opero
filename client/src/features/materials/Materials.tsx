import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { PageLayout } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { LAVENDER } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getMaterialsPage,
  getCategories,
  createMaterial,
  updateMaterial,
  updateInventory,
  deleteMaterial,
  type MaterialCounts,
  type MaterialRow,
  type MaterialInput,
} from "./api";
import { FILTERS, FILTER_LABEL_KEYS, type MaterialFilter } from "./constants";
import { MaterialsActions } from "./components/MaterialsActions";
import { MaterialsKpis } from "./components/MaterialsKpis";
import { MaterialsTable } from "./components/MaterialsTable";
import { MaterialDialog } from "./components/MaterialDialog";

export function Materials() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "admin";

  const [activeFilter, setActiveFilter] = useState<MaterialFilter>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { data: categories } = useApi<string[]>(getCategories);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [deleting, setDeleting] = useState<MaterialRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Server-side search (debounced) + server-side status filter. Both reset the
  // paged list to page 1 (they're in the deps below). reloadKey bumps after
  // create/edit/delete to refetch the list.
  const debouncedSearch = useDebounced(search, 300);
  const statusFilter = activeFilter === "all" ? undefined : activeFilter;

  const { items, meta, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<MaterialRow, { counts: MaterialCounts }>(
      (cursor) =>
        getMaterialsPage({
          cursor,
          search: debouncedSearch || undefined,
          filter: statusFilter,
        }),
      [debouncedSearch, statusFilter, reloadKey],
    );

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Counts come from the first page response (whole-set totals); fall back to
  // zeros until the first page lands.
  const counts: MaterialCounts = meta?.counts ?? { total: 0, ok: 0, low: 0, out_of_stock: 0 };
  const kpis = useMemo(
    () => [
      { label: t("materials.kpis.totalItems"), value: counts.total, tone: "#6750A4" },
      { label: t("materials.kpis.low"), value: counts.low, tone: "#B3261E" },
      { label: t("materials.kpis.outOfStock"), value: counts.out_of_stock, tone: "#B3261E" },
      { label: t("materials.kpis.stockOk"), value: counts.ok, tone: "#1E8E5A" },
    ],
    [counts, t],
  );

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setDialogOpen(true);
  };
  // Open the create dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(openCreate, canManage);
  const openEdit = (m: MaterialRow) => {
    setEditing(m);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (input: MaterialInput) => {
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        // Split update: material fields, then inventory fields.
        await updateMaterial(editing.id, {
          name: input.name,
          unit: input.unit,
          category: input.category,
        });
        await updateInventory(editing.id, {
          quantityInStock: input.stock,
          reorderPoint: input.minStock,
          supplier: input.supplier,
          unit: input.unit,
        });
      } else {
        await createMaterial(input);
      }
      setDialogOpen(false);
      setToast(t(editing ? "materials.toast.updated" : "materials.toast.created"));
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("materials.toast.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteMaterial(deleting.id);
      setDeleting(null);
      setToast(t("materials.toast.deleted"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("materials.toast.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout
      title={t("materials.title")}
      actions={
        <MaterialsActions
          search={search}
          onSearch={setSearch}
          onCreate={openCreate}
          canCreate={canManage}
        />
      }
    >
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
        <MaterialsTable
          rows={items}
          canManage={canManage}
          onEdit={openEdit}
          onDelete={setDeleting}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}

      <MaterialDialog
        open={dialogOpen}
        material={editing}
        categories={categories ?? []}
        busy={busy}
        error={formError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("materials.delete.title")}
        body={deleting ? t("materials.delete.body", { name: deleting.name }) : undefined}
        busy={busy}
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </PageLayout>
  );
}
