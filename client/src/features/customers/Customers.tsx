import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { LAVENDER, RADIUS } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type Customer,
  type CustomerInput,
} from "./api";
import { FILTERS, type CustomerFilter } from "./constants";
import { CustomersActions } from "./components/CustomersActions";
import { CustomersTable } from "./components/CustomersTable";
import { CustomerDialog } from "./components/CustomerDialog";

export function Customers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "admin";

  const [activeFilter, setActiveFilter] = useState<CustomerFilter>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useApi<Customer[]>(getCustomers, [reloadKey]);

  // Dialog state: editing holds the customer (or null for create); deleting
  // holds the customer to delete.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const customers = data ?? [];
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const counts = useMemo(
    () => [
      { key: "total", value: customers.length },
      { key: "business", value: customers.filter((c) => c.type === "business").length },
      { key: "private", value: customers.filter((c) => c.type === "private").length },
    ],
    [customers],
  );

  const filtered = useMemo(() => {
    let rows = customers;
    if (activeFilter !== "all") rows = rows.filter((c) => c.type === activeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [customers, activeFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setDialogOpen(true);
  };
  // Open the create dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(openCreate, canManage);
  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (input: CustomerInput) => {
    setBusy(true);
    setFormError(null);
    try {
      if (editing) await updateCustomer(editing.id, input);
      else await createCustomer(input);
      setDialogOpen(false);
      setToast(t(editing ? "customers.toast.updated" : "customers.toast.created"));
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("customers.toast.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCustomer(deleting.id);
      setDeleting(null);
      setToast(t("customers.toast.deleted"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("customers.toast.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout
      title={t("customers.title")}
      actions={
        <CustomersActions
          search={search}
          onSearch={setSearch}
          onCreate={openCreate}
          canCreate={canManage}
        />
      }
    >
      {/* Summary counts */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        {counts.map((c) => (
          <Box
            key={c.key}
            sx={{ px: 2, py: 1, borderRadius: `${RADIUS.control}px`, bgcolor: "#FFFFFF", border: "1px solid", borderColor: "divider", fontSize: 14, fontWeight: 600, color: "text.secondary" }}
          >
            {t(`customers.counts.${c.key}`)}: {c.value}
          </Box>
        ))}
      </Box>

      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f === activeFilter;
          return (
            <Chip
              key={f}
              label={t(`customers.filters.${f}`)}
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
        <CustomersTable
          customers={filtered}
          canManage={canManage}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      <CustomerDialog
        open={dialogOpen}
        customer={editing}
        busy={busy}
        error={formError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("customers.delete.title")}
        body={deleting ? t("customers.delete.body", { name: deleting.name }) : undefined}
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
