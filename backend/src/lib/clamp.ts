// Ported from the Zustand store: bound user input to sane sizes before persist.
const MAX_TEXT = 4000;
const MAX_NUMBER = 1_000_000;

export function clampText(value: string | undefined | null): string {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_TEXT);
}

export function clampNumber(value: number | undefined | null): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_NUMBER, n));
}
