import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { FilterSelect } from "../../components/FilterSelect";
import { FilterSideSheet } from "../../components/FilterSideSheet";
import { useAuth } from "../../auth/AuthContext";
import { isOffice } from "@opero/shared";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getWorkOrdersPage,
  getWorkOrderFilterOptions,
  type WorkOrderCounts,
  type WorkOrderFilters,
  type WorkOrderRow,
  type WorkOrderStatus,
} from "./api";
import { FILTERS } from "./constants";
import { useApi } from "../../lib/api/useApi";
import { WorkOrdersActions } from "./components/WorkOrdersActions";
import { WorkOrdersTable } from "./components/WorkOrdersTable";
import { WorkOrderFilterBar } from "./components/WorkOrderFilterBar";
import { CreateWorkOrderDialog } from "./components/CreateWorkOrderDialog";

const EMPTY_COUNTS: WorkOrderCounts = {
  total: 0,
  open: 0,
  planned: 0,
  released: 0,
  in_progress: 0,
  ready_for_review: 0,
  approved: 0,
  ready_to_invoice: 0,
  invoiced: 0,
  completed: 0,
};

export function WorkOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Werkbon setup (customer + project) is an office task â€” admin only. Technicians
  // are assigned werkbons and fill them in on the detail screen; they don't create.
  const canCreate = isOffice(user?.role ?? "client");

  const statusFromUrl = searchParams.get("status");
  const activeFilter =
    FILTERS.find((filter) => filter.status === statusFromUrl)?.key ?? "all";
  const setActiveFilter = (key: string) => {
    const next = new URLSearchParams(searchParams);
    const status = FILTERS.find((filter) => filter.key === key)?.status;
    if (status) next.set("status", status);
    else next.delete("status");
    setSearchParams(next);
  };
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<WorkOrderFilters>({});

  // How many narrowing filters are set. Badged on the toggle so an active
  // filter is never invisible while the panel is collapsed.
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (activeFilter === "all" ? 0 : 1);

  // Server-side search (debounced) + server-side status filter. Both reset the
  // paged list to page 1 (they're in the deps below).
  const debouncedSearch = useDebounced(search, 300);
  const statusFilter =
    (FILTERS.find((f) => f.key === activeFilter)?.status as WorkOrderStatus | null) ??
    undefined;

  // Dropdown contents, fetched once. Scoped server-side to what this role can
  // see, so the menus never name a customer or colleague they can't view.
  const { data: filterOptions, loading: optionsLoading } = useApi(
    () => getWorkOrderFilterOptions(),
    [],
  );

  // Every filter is a dep, so changing one restarts the paged list at page 1
  // rather than appending onto a stale cursor.
  const { customerId, assigneeId, materialId, dateFrom, dateTo } = filters;
  const { items, meta, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<WorkOrderRow, { counts: WorkOrderCounts }>(
      (cursor) =>
        getWorkOrdersPage({
          cursor,
          search: debouncedSearch || undefined,
          status: statusFilter,
          customerId,
          assigneeId,
          materialId,
          dateFrom,
          dateTo,
        }),
      [
        debouncedSearch,
        statusFilter,
        customerId,
        assigneeId,
        materialId,
        dateFrom,
        dateTo,
      ],
    );

  // Whole-set counts from the first page (query-wide; unchanged as you load more).
  const counts = meta?.counts ?? EMPTY_COUNTS;

  // Open the create dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(() => setCreateOpen(true), canCreate);

  return (
    <PageLayout
      title={t("workOrders.title")}
      actions={
        <WorkOrdersActions
          search={search}
          onSearch={setSearch}
          onCreate={() => setCreateOpen(true)}
          canCreate={canCreate}
        />
      }
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <FilterSideSheet
          open={filtersOpen}
          onOpen={() => setFiltersOpen(true)}
          onClose={() => setFiltersOpen(false)}
          activeCount={activeFilterCount}
          onClear={() => {
            setActiveFilter("all");
            setFilters({});
          }}
        >
          <FilterSelect
            value={activeFilter}
            onChange={setActiveFilter}
            ariaLabel={t("workOrders.filters.label")}
            fullWidth
            options={FILTERS.map((f) => ({
              value: f.key,
              label: t(`workOrders.filters.${f.key}`),
              count: f.status === null ? counts.total : counts[f.status],
            }))}
          />
          <WorkOrderFilterBar
            open
            filters={filters}
            onChange={setFilters}
            options={filterOptions}
            loading={optionsLoading}
          />
        </FilterSideSheet>
      </Box>
      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <WorkOrdersTable
          rows={items}
          onOpen={(id) => navigate(`/work-orders/${id}`)}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}

      <CreateWorkOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          navigate(`/work-orders/${id}`);
        }}
      />
    </PageLayout>
  );
}
