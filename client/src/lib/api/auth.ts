import type { UserRole } from "@opero/shared";
import { api } from "./client";
import { clearTokens, getRefreshToken, setTokens } from "./tokens";

export type NotificationPrefs = {
  newWorkOrder: boolean;
  urgentOnSite: boolean;
  extraWorkApproval: boolean;
  weeklySummary: boolean;
};

export type UserPreferences = {
  language: "nl" | "en";
  notifications: NotificationPrefs;
};

export type AuthUser = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  customerId: string | null;
  employeeId: string | null;
  totpEnabled: boolean;
  avatar?: string;
  avatarUrl?: string;
  preferences: UserPreferences;
};

type LoginSuccess = { accessToken: string; refreshToken: string; user: AuthUser };
type LoginMfa = { mfaRequired: true; mfaToken: string };
type LoginResponse = LoginSuccess | LoginMfa;

// Log in. Returns the user on success, or { mfaRequired } if 2FA is on.
export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser } | { mfaRequired: true; mfaToken: string }> {
  const res = await api.post<LoginResponse>("/auth/login", { email, password }, { auth: false });
  if ("mfaRequired" in res) return res;
  setTokens(res.accessToken, res.refreshToken);
  return { user: res.user };
}

// Complete a 2FA login with the code from the authenticator app.
export async function loginWith2fa(mfaToken: string, code: string): Promise<AuthUser> {
  const res = await api.post<LoginSuccess>("/auth/login/2fa", { mfaToken, code }, { auth: false });
  setTokens(res.accessToken, res.refreshToken);
  return res.user;
}

// --- Two-factor (TOTP) management -----------------------------------------

export type TwoFactorSetup = { secret: string; otpauthUrl: string; qrDataUrl: string };

// Begin enrolment: generate a pending secret + QR to scan. Not active until
// confirmed with enable2fa().
export function setup2fa(): Promise<TwoFactorSetup> {
  return api.post<TwoFactorSetup>("/auth/2fa/setup", {});
}

// Confirm enrolment with a code from the authenticator app → 2FA becomes active.
export function enable2fa(code: string): Promise<void> {
  return api.post<void>("/auth/2fa/enable", { code });
}

// Turn 2FA off. Requires the account password.
export function disable2fa(password: string): Promise<void> {
  return api.post<void>("/auth/2fa/disable", { password });
}

// Change the logged-in user's own password. The server revokes all sessions and
// returns a fresh pair for THIS one, so we swap the tokens in and stay logged in
// (other devices are logged out).
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const refreshToken = getRefreshToken() ?? undefined;
  const res = await api.post<{ accessToken: string; refreshToken: string }>(
    "/auth/change-password",
    { currentPassword, newPassword, refreshToken },
  );
  setTokens(res.accessToken, res.refreshToken);
}

// --- Password reset (unauthenticated) -------------------------------------

// Request a reset link. Always resolves (server returns 204 regardless of
// whether the email exists — no enumeration).
export function forgotPassword(email: string): Promise<void> {
  return api.post<void>("/auth/forgot-password", { email }, { auth: false });
}

// Set a new password using the token from the emailed link.
export function resetPassword(token: string, newPassword: string): Promise<void> {
  return api.post<void>("/auth/reset-password", { token, newPassword }, { auth: false });
}

// Who am I — used on app load to restore the session.
export async function me(): Promise<AuthUser> {
  const res = await api.get<{ user: AuthUser }>("/auth/me");
  return res.user;
}

// Log out: revoke the refresh token server-side, then clear local tokens.
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await api.post("/auth/logout", { refreshToken }, { auth: false });
  } catch {
    // ignore network/abort errors on logout
  } finally {
    clearTokens();
  }
}
