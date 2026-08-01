import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { PageLayout } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { isOffice, canManageAccounts, canActOnAccount } from "@opero/shared";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getEmployeesPage,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type EmployeeCounts,
  type EmployeeRow,
  type EmployeeInput,
} from "./api";
import type { EmployeeFilter } from "./constants";
import { EmployeesActions } from "./components/EmployeesActions";
import { EmployeesFilterChips } from "./components/EmployeesFilterChips";
import { EmployeesKpis } from "./components/EmployeesKpis";
import { EmployeesTable } from "./components/EmployeesTable";
import { EmployeeDialog } from "./components/EmployeeDialog";
import { AbsenceDialog } from "./components/AbsenceDialog";
import { InviteDialog, type InviteFixedTarget } from "../users/components/InviteDialog";
import {
  inviteUser,
  resendInvite,
  disableUser,
  enableUser,
  updateUserRole,
  type InviteInput,
  type StaffRole,
} from "../users/api";

const EMPTY_COUNTS: EmployeeCounts = {
  total: 0,
  active: 0,
  on_leave: 0,
  inactive: 0,
  technicians: 0,
  office: 0,
  no_account: 0,
};

export function Employees() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role ?? "client";
  // TWO different permissions, deliberately kept apart:
  //   canManage        — the employee RECORD (create/edit). Office staff too.
  //   canManageAccount — whether the LOGIN panel shows at all. Admin + office;
  //                      WHICH accounts it can act on is per-target, decided
  //                      inside AccountSection by canActOnAccount.
  const canManage = isOffice(role);
  const canManageAccount = canManageAccounts(role);
  // Deleting revokes the target's login too, so the same level rule applies:
  // you can't delete someone at or above your own level. Office removes
  // technicians and employees with no login; only an owner removes an owner.
  // An employee with no login has nothing to outrank, so anyone managing
  // records may delete them.
  const canDelete = (e: EmployeeRow) =>
    canManage && (!e.account || canActOnAccount(role, e.account.role));

  const [activeFilter, setActiveFilter] = useState<EmployeeFilter>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Server-side search (debounced) + server-side filter. Both reset the paged
  // list to page 1 (they're in the deps below), as does a refresh (reloadKey).
  const debouncedSearch = useDebounced(search, 300);
  const filter = activeFilter === "all" ? undefined : activeFilter;

  const { items, meta, loading, loadingMore, error, hasMore, loadMore } =
    usePagedApi<EmployeeRow, { counts: EmployeeCounts }>(
      (cursor) =>
        getEmployeesPage({
          cursor,
          search: debouncedSearch || undefined,
          filter,
        }),
      [debouncedSearch, filter, reloadKey],
    );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Non-null → the absence dialog is open for that employee.
  const [absenceTarget, setAbsenceTarget] = useState<EmployeeRow | null>(null);

  // Invite flow — provision a login for this employee (person already known).
  const [inviteTarget, setInviteTarget] = useState<InviteFixedTarget | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  // Non-null → confirming revocation of that employee's login.
  const [disableTarget, setDisableTarget] = useState<EmployeeRow | null>(null);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Whole-set counts from the first page (query-wide; unchanged as you load more).
  const counts = meta?.counts ?? EMPTY_COUNTS;

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setDialogOpen(true);
  };
  // Open the create dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(openCreate, canManage);
  const openEdit = (e: EmployeeRow) => {
    setEditing(e);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (input: EmployeeInput) => {
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await updateEmployee(editing.id, input);
        setDialogOpen(false);
        setToast(t("employees.toast.updated"));
      } else {
        await createEmployee(input);
        setDialogOpen(false);
        setToast(t("employees.toast.created"));
      }
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("employees.toast.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const openInvite = (e: EmployeeRow) => {
    setInviteError(null);
    setInviteTarget({ kind: "employee", id: e.id, name: e.name });
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

  // Re-send a pending invite from the employee dialog. The backend only accepts
  // this for accounts still in "invited" (see users/routes.ts resend-invite).
  const handleResend = async (e: EmployeeRow) => {
    if (!e.account) return;
    setAccountBusy(true);
    try {
      await resendInvite(e.account.userId);
      setToast(t("users.toast.resent", { name: e.name }));
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
    }
  };

  // Revoke this employee's login. Unlike resend, this changes status — so it
  // refreshes the list. The edit dialog was already closed by the hand-off to
  // the confirm dialog, so there's no stale snapshot to re-sync.
  const handleDisable = async () => {
    if (!disableTarget?.account) return;
    setAccountBusy(true);
    try {
      await disableUser(disableTarget.account.userId);
      setDisableTarget(null);
      setToast(t("users.toast.disabled", { name: disableTarget.name }));
      refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
    }
  };

  // Restore access. Fired from inside the open dialog, so close it on success:
  // `editing` holds a snapshot that the refresh would leave stale.
  const handleEnable = async (e: EmployeeRow) => {
    if (!e.account) return;
    setAccountBusy(true);
    try {
      await enableUser(e.account.userId);
      setDialogOpen(false);
      setToast(t("users.toast.enabled", { name: e.name }));
      refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
    }
  };

  // Change this employee's ACCESS LEVEL (not their job title — that's `roles`
  // on the record itself). Unlike enable/disable this keeps the dialog open, so
  // the `editing` snapshot is patched in place rather than going stale behind a
  // list refresh.
  const handleChangeRole = async (e: EmployeeRow, role: StaffRole) => {
    if (!e.account) return;
    setAccountBusy(true);
    try {
      const updated = await updateUserRole(e.account.userId, role);
      setEditing((prev) =>
        prev && prev.account
          ? { ...prev, account: { ...prev.account, role: updated.role } }
          : prev,
      );
      setToast(t("users.toast.roleChanged", { role: t(`users.roles.${updated.role}`) }));
      refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : t("users.toast.actionError"));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteEmployee(deleting.id);
      setDeleting(null);
      setToast(t("employees.toast.deleted"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("employees.toast.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout
      title={t("employees.title")}
      actions={
        <EmployeesActions
          search={search}
          onSearch={setSearch}
          onCreate={openCreate}
          canCreate={canManage}
        />
      }
    >
      <EmployeesKpis counts={counts} />

      <EmployeesFilterChips value={activeFilter} counts={counts} onChange={setActiveFilter} />

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <EmployeesTable
          rows={items}
          canManage={canManage}
          onEdit={openEdit}
          onAbsences={setAbsenceTarget}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}

      <AbsenceDialog
        employee={absenceTarget}
        onClose={() => setAbsenceTarget(null)}
      />

      <EmployeeDialog
        open={dialogOpen}
        employee={editing}
        busy={busy}
        error={formError}
        // Gates the AccountSection only — the LOGIN, not the record.
        canManage={canManageAccount}
        canDelete={editing ? canDelete(editing) : false}
        accountBusy={accountBusy}
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
        onChangeRole={(role) => editing && handleChangeRole(editing, role)}
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
        title={t("employees.dialog.account.confirmDisableTitle")}
        body={
          disableTarget
            ? t("employees.dialog.account.confirmDisableBody", { name: disableTarget.name })
            : undefined
        }
        busy={accountBusy}
        destructive
        // Not a delete — the account is kept, just revoked.
        confirmLabel={t("employees.dialog.account.disable")}
        onClose={() => setDisableTarget(null)}
        onConfirm={handleDisable}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("employees.delete.title")}
        body={deleting ? t("employees.delete.body", { name: deleting.name }) : undefined}
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
