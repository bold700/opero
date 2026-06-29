import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { LAVENDER, RADIUS } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { useCreateParam } from "../../lib/useCreateParam";
import { getWorkOrders, type WorkOrderRow } from "./api";
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

export function WorkOrders() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "technician";

  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data, loading, error } = useApi<WorkOrderRow[]>(getWorkOrders);

  // Open the create dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(() => setCreateOpen(true), canCreate);

  const rows = data ?? [];

  const counts = useMemo(
    () => [
      { key: "total", value: rows.length },
      { key: "open", value: rows.filter((r) => r.status === "open").length },
      { key: "onTheWay", value: rows.filter((r) => r.status === "on_the_way").length },
      { key: "urgent", value: rows.filter((r) => r.status === "urgent").length },
      { key: "done", value: rows.filter((r) => r.status === "done").length },
    ],
    [rows],
  );

  const filtered = useMemo(() => {
    const status = FILTERS.find((f) => f.key === activeFilter)?.status ?? null;
    const byStatus = status ? rows.filter((r) => r.status === status) : rows;
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (r) =>
        r.number.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q),
    );
  }, [rows, activeFilter, search]);

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
        {counts.map((c) => (
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
          rows={filtered}
          onOpen={(id) => navigate(`/work-orders/${id}`)}
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
