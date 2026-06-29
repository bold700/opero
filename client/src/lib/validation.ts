// Light form validation — just enough to stop garbage (required, email, numbers
// >= 0). The backend zod schemas are the real guard; this is for inline UX.
//
// A validator takes a value and returns an i18n error KEY (under "validation.*")
// or null when valid. Components translate the key with t().

export type Validator = (value: string) => string | null;

export const required: Validator = (v) =>
  v.trim().length === 0 ? "common.validation.required" : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email is optional in most forms → only invalid when non-empty and malformed.
export const email: Validator = (v) =>
  v.trim() === "" || EMAIL_RE.test(v.trim()) ? null : "common.validation.email";

// Number >= 0 (allows empty = optional). Rejects negative / non-numeric.
export const nonNegativeNumber: Validator = (v) => {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return "common.validation.number";
  if (n < 0) return "common.validation.nonNegative";
  return null;
};

// Run several validators; first error wins.
export function firstError(value: string, ...validators: Validator[]): string | null {
  for (const fn of validators) {
    const err = fn(value);
    if (err) return err;
  }
  return null;
}
