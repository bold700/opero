import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { HAIRLINE, RADIUS } from "../../../theme/tokens";
import { AccountStatusChip } from "./AccountStatusChip";
import type { LinkedAccount } from "../api";

// The login account for the record being edited, shown inside the customer /
// employee dialog. This is the ONLY place access is managed — there is no
// separate Toegang screen — so it covers the whole lifecycle: invite, resend,
// disable, enable.
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
}) {
  const { t, i18n } = useTranslation();

  // No email → nothing to send an invite to. Explain why the button is off
  // rather than leaving a dead control.
  const canInvite = email.trim().length > 0;

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
          <DetailRow label={t(`${labelKeys}.role`)} value={t(`users.roles.${account.role}`)} />
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
