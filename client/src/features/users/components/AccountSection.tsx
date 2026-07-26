import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { canActOnAccount, grantableRoles, type UserRole } from "@opero/shared";
import { useAuth } from "../../../auth/AuthContext";
import { SelectField } from "../../../components/SelectField";
import { HAIRLINE, RADIUS } from "../../../theme/tokens";
import { AccountStatusChip } from "./AccountStatusChip";
import type { LinkedAccount, StaffRole } from "../api";

// The login account for the record being edited, shown inside the customer /
// employee dialog. This is the ONLY place access is managed — there is no
// separate Toegang screen — so it covers the whole lifecycle: invite, resend,
// disable, enable.
//
// Open to admin AND office, but per-target: you can't act on an account at or
// above your own level, so office manages technicians and clients while an
// admin or another office user is shown read-only. The backend enforces the
// same rule (users/routes.ts) — this only keeps the UI from offering a button
// that would 403.
//
// `labelKeys` lets each feature supply its own copy namespace
// ("customers.dialog.account" / "employees.dialog.account") so the
// needs-an-email hint can name the right kind of person.
export function AccountSection({
  account,
  email,
  busy,
  labelKeys,
  isSelf,
  onInvite,
  onResend,
  onDisable,
  onEnable,
  onChangeRole,
}: {
  account: LinkedAccount;
  email: string;
  busy: boolean;
  labelKeys: string;
  /** True when this record's login is the signed-in user's own. */
  isSelf: boolean;
  onInvite: () => void;
  onResend: () => void;
  onDisable: () => void;
  onEnable: () => void;
  /** Omitted where the level can't change (customers are always `client`). */
  onChangeRole?: (role: StaffRole) => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const actorRole = (user?.role ?? "client") as UserRole;

  // No email → nothing to send an invite to. Explain why the button is off
  // rather than leaving a dead control.
  const canInvite = email.trim().length > 0;

  // An existing account at or above the actor's level is read-only: office may
  // not resend/disable/enable an admin or another office user. Note this is
  // about the ACCOUNT's role, not the person's job title.
  const outranked = !!account && !canActOnAccount(actorRole, account.role as UserRole);

  // Levels the actor may move this account to. `client` is excluded because it
  // isn't a level — it pairs with a Customer record — so a customer login shows
  // its role read-only and never gets the picker.
  const roleOptions = grantableRoles(actorRole).filter(
    (r): r is StaffRole => r !== "client",
  );

  // Changing your OWN level is refused by the backend too: the only admin
  // demoting themselves would leave nobody able to promote anyone back.
  const canChangeRole =
    !!account &&
    !!onChangeRole &&
    !outranked &&
    !isSelf &&
    account.role !== "client" &&
    roleOptions.length > 1;

  // You can't revoke your own access — that would instantly log you out, and
  // it's the guard that stops the last admin locking the org out. The backend
  // refuses it too (users/routes.ts disable). Shown-but-disabled, not hidden:
  // a missing button reads as a bug.
  const disableButton = () => {
    const button = (
      <Box component="span">
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={onDisable}
          disabled={busy || isSelf}
        >
          {t(`${labelKeys}.disable`)}
        </Button>
      </Box>
    );
    return isSelf ? (
      <Tooltip title={t(`${labelKeys}.selfDisableHint`)}>{button}</Tooltip>
    ) : (
      button
    );
  };

  const actions = () => {
    // Say WHY there are no buttons — silence here is what made the missing
    // panel read as a broken feature before.
    if (outranked) {
      return (
        <Typography variant="caption" color="text.secondary">
          {t(`${labelKeys}.outranked`)}
        </Typography>
      );
    }
    if (!account) {
      const button = (
        <Box component="span">
          <Button size="small" variant="outlined" onClick={onInvite} disabled={busy || !canInvite}>
            {t(`${labelKeys}.invite`)}
          </Button>
        </Box>
      );
      return canInvite ? button : <Tooltip title={t(`${labelKeys}.needsEmail`)}>{button}</Tooltip>;
    }
    if (account.status === "disabled") {
      return (
        <Button size="small" variant="outlined" onClick={onEnable} disabled={busy}>
          {t(`${labelKeys}.enable`)}
        </Button>
      );
    }
    // Only a pending invite can be re-sent; the backend rejects the rest.
    return (
      <>
        {account.status === "invited" ? (
          <Button size="small" variant="outlined" onClick={onResend} disabled={busy}>
            {t(`${labelKeys}.resend`)}
          </Button>
        ) : null}
        {disableButton()}
      </>
    );
  };

  const activatedAt = account?.activatedAt
    ? new Date(account.activatedAt).toLocaleDateString(i18n.language)
    : null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        p: 1.5,
        border: "1px solid",
        borderColor: HAIRLINE,
        borderRadius: `${RADIUS.control}px`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t(`${labelKeys}.title`)}
        </Typography>
        <AccountStatusChip account={account} />
      </Box>

      {/* What this login actually is. Only meaningful once one exists. */}
      {account ? (
        <Box sx={{ display: "grid", gap: 0.25 }}>
          {canChangeRole ? (
            <SelectField
              label={t(`${labelKeys}.role`)}
              value={account.role}
              onChange={(v) => onChangeRole!(v as StaffRole)}
              disabled={busy}
              options={roleOptions.map((r) => ({
                value: r,
                label: t(`users.roles.${r}`),
              }))}
            />
          ) : (
            <DetailRow label={t(`${labelKeys}.role`)} value={t(`users.roles.${account.role}`)} />
          )}
          <DetailRow label={t(`${labelKeys}.email`)} value={account.email} />
          {activatedAt ? (
            <DetailRow label={t(`${labelKeys}.activatedAt`)} value={activatedAt} />
          ) : null}
        </Box>
      ) : null}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        {busy ? <CircularProgress size={16} /> : null}
        {actions()}
      </Box>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" sx={{ textAlign: "right", wordBreak: "break-all" }}>
        {value}
      </Typography>
    </Box>
  );
}
