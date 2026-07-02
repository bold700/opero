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
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type EmployeeRow,
  type EmployeeInput,
} from "./api";
import { FILTERS, FILTER_LABEL_KEY, isOffice, type EmployeeFilter } from "./constants";
import { EmployeesActions } from "./components/EmployeesActions";
import { EmployeesKpis } from "./components/EmployeesKpis";
import { EmployeesTable } from "./components/EmployeesTable";
import { EmployeeDialog } from "./components/EmployeeDialog";
import { InviteDialog, type InviteFixedTarget } from "../users/components/InviteDialog";
import { inviteUser, type InviteInput } from "../users/api";

export function Employees() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = user?.role === "admin";

  const [activeFilter, setActiveFilter] = useState<EmployeeFilter>("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useApi<EmployeeRow[]>(getEmployees, [reloadKey]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Invite flow — provision a login for this employee (person already known).
  const [inviteTarget, setInviteTarget] = useState<InviteFixedTarget | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const rows = data ?? [];
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const kpis = useMemo(
    () => [
      { label: t("employees.kpis.total"), value: rows.length, tone: "#1D1B20" },
      { label: t("employees.kpis.technicians"), value: rows.filter((r) => !isOffice(r.function)).length, tone: "#1D1B20" },
      { label: t("employees.kpis.office"), value: rows.filter((r) => isOffice(r.function)).length, tone: "#1D1B20" },
      { label: t("employees.kpis.active"), value: rows.filter((r) => r.status === "active").length, tone: "#1E8E5A" },
    ],
    [rows, t],
  );

  const filtered = useMemo(() => {
    let out = rows;
    switch (activeFilter) {
      case "technicians":
        out = out.filter((r) => !isOffice(r.function));
        break;
      case "office":
        out = out.filter((r) => isOffice(r.function));
        break;
      case "inactive":
        out = out.filter((r) => r.status === "inactive");
        break;
    }
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q));
    return out;
  }, [rows, activeFilter, search]);

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
      if (editing) await updateEmployee(editing.id, input);
      else await createEmployee(input);
      setDialogOpen(false);
      setToast(t(editing ? "employees.toast.updated" : "employees.toast.created"));
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
      <EmployeesKpis kpis={kpis} />

      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f === activeFilter;
          return (
            <Chip
              key={f}
              label={t(FILTER_LABEL_KEY[f])}
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
        <EmployeesTable
          rows={filtered}
          canManage={canManage}
          onEdit={openEdit}
          onDelete={setDeleting}
          onInvite={openInvite}
        />
      )}

      <EmployeeDialog
        open={dialogOpen}
        employee={editing}
        busy={busy}
        error={formError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
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
