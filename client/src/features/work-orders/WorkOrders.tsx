import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { LAVENDER } from "../../theme/tokens";
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

export function WorkOrders() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Werkbon setup (customer + project) is an office task — admin only. Technicians
  // are assigned werkbons and fill them in on the detail screen; they don't create.
  const canCreate = user?.role === "admin";

  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<WorkOrderFilters>({});

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
  const { items, loading, loadingMore, error, hasMore, loadMore } =
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
      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f.key === activeFilter;
          return (
            <Chip
              key={f.key}
              label={t(`workOrders.filters.${f.key}`)}
              onClick={() => setActiveFilter(f.key)}
              variant={active ? "filled" : "outlined"}
              sx={active ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 } : { color: "text.secondary" }}
            />
          );
        })}
      </Box>

      <WorkOrderFilterBar
        open={filtersOpen}
        onToggle={() => setFiltersOpen((v) => !v)}
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
