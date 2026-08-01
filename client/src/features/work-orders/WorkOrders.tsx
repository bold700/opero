import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { FilterSelect } from "../../components/FilterSelect";
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
import { WorkOrderFilterToggle } from "./components/WorkOrderFilterToggle";
import { CreateWorkOrderDialog } from "./components/CreateWorkOrderDialog";

const EMPTY_COUNTS: WorkOrderCounts = {
  total: 0,
  open: 0,
  on_the_way: 0,
  urgent: 0,
  done: 0,
};

export function WorkOrders() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Werkbon setup (customer + project) is an office task — admin only. Technicians
  // are assigned werkbons and fill them in on the detail screen; they don't create.
  const canCreate = isOffice(user?.role ?? "client");

  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<WorkOrderFilters>({});

  // How many narrowing filters are set. Badged on the toggle so an active
  // filter is never invisible while the panel is collapsed.
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
  const { customerId, assigneeId, workTypeId, dateFrom, dateTo } = filters;
  const { items, meta, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<WorkOrderRow, { counts: WorkOrderCounts }>(
      (cursor) =>
        getWorkOrdersPage({
          cursor,
          search: debouncedSearch || undefined,
          status: statusFilter,
          customerId,
          assigneeId,
          workTypeId,
          dateFrom,
          dateTo,
        }),
      [
        debouncedSearch,
        statusFilter,
        customerId,
        assigneeId,
        workTypeId,
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
      {/* Status filter (left) + the Filters toggle (far right) share ONE row,
          so the collapsed filter UI costs no vertical space of its own. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <FilterSelect
          value={activeFilter}
          onChange={setActiveFilter}
          ariaLabel={t("workOrders.filters.label")}
          // `key` is camelCase for the i18n lookup, `status` is the snake_case
          // value that doubles as the WorkOrderCounts key ("all" → total).
          options={FILTERS.map((f) => ({
            value: f.key,
            label: t(`workOrders.filters.${f.key}`),
            count: f.status === null ? counts.total : counts[f.status],
          }))}
        />

        <WorkOrderFilterToggle
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
          activeCount={activeFilterCount}
          onClear={() => setFilters({})}
        />
      </Box>

      <WorkOrderFilterBar
        open={filtersOpen}
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        loading={optionsLoading}
      />

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
