import { api } from "../../lib/api/client";
import type { AuthUser, NotificationPrefs } from "../../lib/api/auth";

// The logged-in user's own profile fields.
export type ProfileInput = {
  name?: string;
  email?: string;
  phone?: string;
};

// PATCH /auth/profile → returns the updated user (same shape as /auth/me).
export async function updateProfile(input: ProfileInput): Promise<AuthUser> {
  const res = await api.patch<{ user: AuthUser }>("/auth/profile", input);
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
