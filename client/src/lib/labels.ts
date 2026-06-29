// Last-resort label for an unmapped enum value: "in_progress" → "In progress".
// Stage/status badges translate via i18n first; this only kicks in when a value
// has no translation, so a raw snake_case enum string never reaches the UI.
export function humanize(value: string): string {
  const s = value.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
