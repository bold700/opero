import { useCallback, useState } from "react";
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
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getCustomersPage,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type Customer,
  type CustomerCounts,
  type CustomerInput,
} from "./api";
import { FILTERS, type CustomerFilter } from "./constants";
import { CustomersActions } from "./components/CustomersActions";
import { ImportDialog } from "./components/ImportDialog";
import { CustomersTable } from "./components/CustomersTable";
import { CustomerDialog } from "./components/CustomerDialog";
import { InviteDialog, type InviteFixedTarget } from "../users/components/InviteDialog";
import { inviteUser, type InviteInput } from "../users/api";

export function Customers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "admin";

  const [activeFilter, setActiveFilter] = useState<CustomerFilter>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Server-side search (debounced) + server-side type filter. Both reset the
  // paged list to page 1 (they're in the deps below); reloadKey does too, so
  // create/edit/invite/delete refresh the list.
  const debouncedSearch = useDebounced(search, 300);
  const filter = activeFilter === "all" ? undefined : activeFilter;

  const { items, meta, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<Customer, { counts: CustomerCounts }>(
      (cursor) =>
        getCustomersPage({
          cursor,
          search: debouncedSearch || undefined,
          filter,
        }),
      [debouncedSearch, filter, reloadKey],
    );

  // Dialog state: editing holds the customer (or null for create); deleting
  // holds the customer to delete.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Invite flow — provision a portal login for this customer (person known).
  const [inviteTarget, setInviteTarget] = useState<InviteFixedTarget | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Counts come from the first page response (whole-set totals); fall back to
  // zeros until the first page lands.
  const pageCounts = meta?.counts ?? { total: 0, business: 0, private: 0 };
  const counts = [
    { key: "total", value: pageCounts.total },
    { key: "business", value: pageCounts.business },
    { key: "private", value: pageCounts.private },
  ];

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

  const openInvite = (c: Customer) => {
    setInviteError(null);
    setInviteTarget({ kind: "customer", id: c.id, name: c.name });
  };

  const handleInvite = async (input: InviteInput) => {
    setInviting(true);
    setInviteError(null);
    try {
      const created = await inviteUser(input);
      setInviteTarget(null);
      setToast(t("users.toast.invited", { email: created.email }));
      refresh();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : t("users.toast.inviteError"));
    } finally {
      setInviting(false);
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
          onImport={() => setImportOpen(true)}
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
          customers={items}
          canManage={canManage}
          onEdit={openEdit}
          onDelete={setDeleting}
          onInvite={openInvite}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
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

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(r) => {
          setToast(t("customers.import.done", { created: r.created, updated: r.updated }));
          refresh();
        }}
      />

      <InviteDialog
        open={inviteTarget !== null}
        fixed={inviteTarget}
        busy={inviting}
        error={inviteError}
        onClose={() => setInviteTarget(null)}
        onSubmit={handleInvite}
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
