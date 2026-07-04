import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { LAVENDER, RADIUS } from "../../theme/tokens";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getWorkOrdersPage,
  type WorkOrderCounts,
  type WorkOrderRow,
  type WorkOrderStatus,
} from "./api";
import { FILTERS } from "./constants";
import { WorkOrdersActions } from "./components/WorkOrdersActions";
import { WorkOrdersTable } from "./components/WorkOrdersTable";
import { CreateWorkOrderDialog } from "./components/CreateWorkOrderDialog";

// Count card keys → tone color.
const COUNT_TONE: Record<string, string> = {
  total: "#49454F",
  open: "#6750A4",
  onTheWay: "#3B82F6",
  urgent: "#B3261E",
  done: "#1E8E5A",
};

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
  const canCreate = user?.role === "admin";

  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Server-side search (debounced) + server-side status filter. Both reset the
  // paged list to page 1 (they're in the deps below).
  const debouncedSearch = useDebounced(search, 300);
  const statusFilter =
    (FILTERS.find((f) => f.key === activeFilter)?.status as WorkOrderStatus | null) ??
    undefined;

  const { items, meta, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<WorkOrderRow, { counts: WorkOrderCounts }>(
      (cursor) =>
        getWorkOrdersPage({
          cursor,
          search: debouncedSearch || undefined,
          status: statusFilter,
        }),
      [debouncedSearch, statusFilter],
    );

  // Open the create dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(() => setCreateOpen(true), canCreate);

  // Counts come from the first page response (whole-set totals); fall back to
  // zeros until the first page lands.
  const pageCounts = meta?.counts ?? EMPTY_COUNTS;
  const countCards = [
    { key: "total", value: pageCounts.total },
    { key: "open", value: pageCounts.open },
    { key: "onTheWay", value: pageCounts.on_the_way },
    { key: "urgent", value: pageCounts.urgent },
    { key: "done", value: pageCounts.done },
  ];

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
      {/* Summary counts */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        {countCards.map((c) => (
          <Box
            key={c.key}
            sx={{
              px: 2,
              py: 1,
              borderRadius: `${RADIUS.control}px`,
              bgcolor: "#FFFFFF",
              border: "1px solid",
              borderColor: "divider",
              fontSize: 14,
              fontWeight: 600,
              color: COUNT_TONE[c.key],
            }}
          >
            {t(`workOrders.counts.${c.key}`)}: {c.value}
          </Box>
        ))}
      </Box>

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
