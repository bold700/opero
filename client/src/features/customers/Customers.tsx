import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { isOffice, canManageAccounts } from "@opero/shared";
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
import { type CustomerFilter } from "./constants";
import { CustomersActions } from "./components/CustomersActions";
import { CustomerFilterBar } from "./components/CustomerFilterBar";
import { ImportDialog } from "./components/ImportDialog";
import { CustomersTable } from "./components/CustomersTable";
import { CustomerDialog } from "./components/CustomerDialog";
import { InviteDialog, type InviteFixedTarget } from "../users/components/InviteDialog";
import {
  inviteUser,
  resendInvite,
  disableUser,
  enableUser,
  type InviteInput,
} from "../users/api";

export function Customers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? "client";
  // The customer RECORD is office work; the customer's LOGIN is not — see the
  // same split in Employees.tsx.
  const canManage = isOffice(role);
  const canManageAccount = canManageAccounts(role);

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
  const [accountBusy, setAccountBusy] = useState(false);
  // Non-null → confirming revocation of that customer's portal login.
  const [disableTarget, setDisableTarget] = useState<Customer | null>(null);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Counts come from the first page response (whole-set totals); fall back to
  // zeros until the first page lands.
  const counts = meta?.counts ?? { total: 0, business: 0, private: 0 };

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

  // Re-send a pending invite from the customer dialog. The backend only accepts
  // this for accounts still in "invited" (see users/routes.ts resend-invite).
  const handleResend = async (c: Customer) => {
    if (!c.account) return;
    setAccountBusy(true);
    try {
      await resendInvite(c.account.userId);
      setToast(t("users.toast.resent", { name: c.name }));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
    }
  };

  // Revoke this customer's portal login. Unlike resend, this changes status —
  // so it refreshes the list. The edit dialog was already closed by the hand-off
  // to the confirm dialog, so there's no stale snapshot to re-sync.
  const handleDisable = async () => {
    if (!disableTarget?.account) return;
    setAccountBusy(true);
    try {
      await disableUser(disableTarget.account.userId);
      setDisableTarget(null);
      setToast(t("users.toast.disabled", { name: disableTarget.name }));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
    }
  };

  // Restore access. Fired from inside the open dialog, so close it on success:
  // `editing` holds a snapshot that the refresh would leave stale.
  const handleEnable = async (c: Customer) => {
    if (!c.account) return;
    setAccountBusy(true);
    try {
      await enableUser(c.account.userId);
      setDialogOpen(false);
      setToast(t("users.toast.enabled", { name: c.name }));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
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
      {/* Filter chips, each with its count inline */}
      <CustomerFilterBar active={activeFilter} counts={counts} onChange={setActiveFilter} />

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
          onOpen={(c) => navigate(`/customers/${c.id}`)}
          onEdit={openEdit}
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
        // Gates the AccountSection only — the LOGIN, not the record.
        canManage={canManageAccount}
        canDelete={canManage}
        accountBusy={accountBusy}
        // Vacuous here (a client login can't reach this screen), but the panel
        // has one contract on both pages.
        isSelf={editing?.account?.userId === user?.id}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        // Hand off to the invite dialog: close this one first so the two
        // never stack.
        onInvite={() => {
          if (!editing) return;
          setDialogOpen(false);
          openInvite(editing);
        }}
        onResend={() => editing && handleResend(editing)}
        // Same hand-off as invite/disable: close this dialog before opening the
        // confirm so the two never stack.
        onDelete={() => {
          if (!editing) return;
          setDialogOpen(false);
          setDeleting(editing);
        }}
        onDisable={() => {
          if (!editing) return;
          setDialogOpen(false);
          setDisableTarget(editing);
        }}
        onEnable={() => editing && handleEnable(editing)}
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
        open={disableTarget !== null}
        title={t("customers.dialog.account.confirmDisableTitle")}
        body={
          disableTarget
            ? t("customers.dialog.account.confirmDisableBody", { name: disableTarget.name })
            : undefined
        }
        busy={accountBusy}
        destructive
        // Not a delete — the account is kept, just revoked.
        confirmLabel={t("customers.dialog.account.disable")}
        onClose={() => setDisableTarget(null)}
        onConfirm={handleDisable}
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
