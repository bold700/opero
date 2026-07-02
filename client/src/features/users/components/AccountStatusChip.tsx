import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../components/StatusBadge";
import { ACCOUNT_STATUS, NO_ACCOUNT_TONE } from "../constants";
import type { LinkedAccount } from "../api";

// Login-status pill for a domain record. `null` account → "no login" state.
export function AccountStatusChip({ account }: { account: LinkedAccount }) {
  const { t } = useTranslation();
  if (!account) {
    return <StatusBadge label={t("users.status.none")} tone={NO_ACCOUNT_TONE} />;
  }
  const s = ACCOUNT_STATUS[account.status];
  return <StatusBadge label={t(s.labelKey)} tone={s.tone} />;
}
