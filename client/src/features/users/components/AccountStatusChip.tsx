import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../components/StatusBadge";
import { ACCOUNT_STATUS, NO_ACCOUNT_TONE } from "../constants";
import type { LinkedAccount } from "../api";

// Where the chip is shown decides the wording:
//   "account" — on a domain record (customer/employee): does this person have a
//               login at all? → Nee / Uitgenodigd / Ja.
//   "status"  — on the Toegang screen, a list OF logins, where "Ja"/"Nee" would
//               be meaningless → Actief / Uitgenodigd / Uitgeschakeld.
type Variant = "account" | "status";

// Login-status pill for a domain record. `null` account → "no login" state.
export function AccountStatusChip({
  account,
  variant = "account",
}: {
  account: LinkedAccount;
  variant?: Variant;
}) {
  const { t } = useTranslation();

  if (!account) {
    const label = variant === "account" ? t("common.account.none") : t("users.status.none");
    return <StatusBadge label={label} tone={NO_ACCOUNT_TONE} />;
  }

  const s = ACCOUNT_STATUS[account.status];
  const label = variant === "account" ? t(`common.account.${account.status}`) : t(s.labelKey);
  return <StatusBadge label={label} tone={s.tone} />;
}
