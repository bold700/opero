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
