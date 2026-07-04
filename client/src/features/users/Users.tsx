import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { PageLayout } from "../../components/PageLayout";
import { NewButton } from "../../components/NewButton";
import { useAuth } from "../../auth/AuthContext";
import { LAVENDER } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import {
  getUsers,
  inviteUser,
  resendInvite,
  disableUser,
  enableUser,
  type UserAccount,
  type InviteInput,
  type AccountStatus,
} from "./api";
import { UsersTable } from "./components/UsersTable";
import { InviteDialog } from "./components/InviteDialog";

type Filter = "all" | AccountStatus;
const FILTERS: Filter[] = ["all", "active", "invited", "disabled"];

// Central access management: who has a login, in what role, and at what stage of
// the invite lifecycle. Admin-only (guarded by the route + nav config).
export function Users() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useApi<UserAccount[]>(getUsers, [reloadKey]);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const [filter, setFilter] = useState<Filter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = data ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((u) => u.status === filter)),
    [rows, filter],
  );

  const handleInvite = async (input: InviteInput) => {
    setInviting(true);
    setInviteError(null);
    try {
      const created = await inviteUser(input);
      setInviteOpen(false);
      setToast(t("users.toast.invited", { email: created.email }));
      refresh();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : t("users.toast.inviteError"));
    } finally {
      setInviting(false);
    }
  };

  // Run a lifecycle action for a single row, showing a per-row spinner + a toast.
  const runAction = async (
    u: UserAccount,
    action: () => Promise<unknown>,
    okKey: string,
  ) => {
    setBusyId(u.id);
    try {
      await action();
      setToast(t(okKey, { name: u.name }));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("users.toast.actionError"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageLayout
      title={t("users.title")}
      actions={<NewButton label={t("users.invite.new")} onClick={() => setInviteOpen(true)} />}
    >
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Chip
              key={f}
              label={t(`users.filters.${f}`)}
              onClick={() => setFilter(f)}
              variant={active ? "filled" : "outlined"}
              sx={active ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 } : { color: "text.secondary" }}
            />
          );
        })}
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <UsersTable
          rows={filtered}
          currentUserId={currentUser?.id}
          busyId={busyId}
          onResend={(u) => runAction(u, () => resendInvite(u.id), "users.toast.resent")}
          onDisable={(u) => runAction(u, () => disableUser(u.id), "users.toast.disabled")}
          onEnable={(u) => runAction(u, () => enableUser(u.id), "users.toast.enabled")}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        busy={inviting}
        error={inviteError}
        onClose={() => setInviteOpen(false)}
        onSubmit={handleInvite}
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
