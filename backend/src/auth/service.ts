import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import {
  DEFAULT_USER_PREFERENCES,
  DEFAULT_NOTIFICATION_PREFS,
  type UserPreferences,
} from "@opero/shared";
import { photoUrl } from "../lib/photoUrls.js";
import type { AuthUser } from "./types.js";

const BCRYPT_COST = 12;

// Merge a user's stored preferences JSON onto the defaults, so the DTO always
// returns a complete, well-typed preferences object (old users have null).
export function mergePreferences(stored: unknown): UserPreferences {
  const p = (stored ?? {}) as Partial<UserPreferences>;
  return {
    language: p.language === "en" || p.language === "nl" ? p.language : DEFAULT_USER_PREFERENCES.language,
    notifications: { ...DEFAULT_NOTIFICATION_PREFS, ...(p.notifications ?? {}) },
  };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Public user shape returned to clients — never leak passwordHash/totpSecret.
// Async because the avatar object key is resolved to a (presigned) URL via the
// storage layer.
export async function toAuthUser(user: User): Promise<AuthUser> {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    roles: user.roles.length > 0 ? user.roles : [user.role],
    customerId: user.customerId,
    employeeId: user.employeeId,
    totpEnabled: user.totpEnabled,
    avatar: user.avatar ?? undefined,
    avatarUrl: await photoUrl(user.avatar),
    preferences: mergePreferences(user.preferences),
  };
}
