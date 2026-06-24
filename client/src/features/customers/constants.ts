import type { CustomerType } from "./api";

// Display helpers for the customers list. (Dutch labels here are placeholders
// until i18n; the underlying values stay English — see api.ts.)

export const FILTERS = ["Alle", "Zakelijk", "Particulier"];

// Dutch display label for a customer type.
export const TYPE_LABEL: Record<CustomerType, string> = {
  business: "Zakelijk",
  private: "Particulier",
};

// Deterministic avatar color from a name, so the same customer always gets the
// same color without storing it.
const AVATAR_COLORS = ["#F59E0B", "#3B82F6", "#1E8E5A", "#9333EA", "#0D9488", "#6B7280", "#B45309"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// "2025-06-18T..." → "18 jun 2025"; null → "—".
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}
