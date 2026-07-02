import { STATUS_TONES, type StatusTone } from "../../theme/tokens";
import type { AccountStatus } from "./api";

// Maps an account's lifecycle status to a label key + a badge tone. Reused by the
// Users view and the login-status chips on Employees/Customers.
export const ACCOUNT_STATUS: Record<
  AccountStatus,
  { labelKey: string; tone: StatusTone }
> = {
  invited: { labelKey: "users.status.invited", tone: STATUS_TONES.warning },
  active: { labelKey: "users.status.active", tone: STATUS_TONES.success },
  disabled: { labelKey: "users.status.disabled", tone: STATUS_TONES.neutral },
};

// The "no login yet" state (a domain record with no linked account).
export const NO_ACCOUNT_TONE = STATUS_TONES.neutral;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
