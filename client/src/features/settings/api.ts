import { api } from "../../lib/api/client";
import type { AuthUser, NotificationPrefs } from "../../lib/api/auth";

// The logged-in user's own profile fields. Email is NOT here — it's the login
// identity and changes only via the verified email-change flow.
export type ProfileInput = {
  name?: string;
  phone?: string;
};

// PATCH /auth/profile → returns the updated user (same shape as /auth/me).
export async function updateProfile(input: ProfileInput): Promise<AuthUser> {
  const res = await api.patch<{ user: AuthUser }>("/auth/profile", input);
  return res.user;
}

// POST /auth/email-change/request — re-auth with the current password, then a
// confirmation link is emailed to newEmail. Returns 204; the email only switches
// once the link is confirmed. Always resolves (no enumeration).
export function requestEmailChange(newEmail: string, currentPassword: string): Promise<void> {
  return api.post<void>("/auth/email-change/request", { newEmail, currentPassword });
}

// POST /auth/avatar (multipart) → returns the updated user with avatarUrl.
export async function uploadAvatar(file: Blob): Promise<AuthUser> {
  const res = await api.upload<{ user: AuthUser }>("/auth/avatar", file);
  return res.user;
}

// DELETE /auth/avatar → returns the updated user (avatar cleared).
export async function deleteAvatar(): Promise<AuthUser> {
  const res = await api.delete<{ user: AuthUser }>("/auth/avatar");
  return res.user;
}

// --- Preferences (language + notification toggles, per-user, server-side) ---

export type PreferencesInput = {
  language?: "nl" | "en";
  notifications?: Partial<NotificationPrefs>;
};

// PATCH /auth/preferences → returns the updated user (same shape as /auth/me).
export async function updatePreferences(input: PreferencesInput): Promise<AuthUser> {
  const res = await api.patch<{ user: AuthUser }>("/auth/preferences", input);
  return res.user;
}

// --- Organization (company tab + the hide-prices flag) --------------------

export type Organization = {
  id: string;
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  vatNumber: string;
  hidePricesFromTechnicians: boolean;
};

export type OrganizationInput = {
  name?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  vatNumber?: string;
  hidePricesFromTechnicians?: boolean;
};

export function getOrganization(): Promise<Organization> {
  return api.get<Organization>("/organization");
}

export function updateOrganization(input: OrganizationInput): Promise<Organization> {
  return api.patch<Organization>("/organization", input);
}
