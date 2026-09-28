// 24-hour time slots in 15-minute steps (00:00 … 23:45) — European clock, no
// AM/PM, no arbitrary minutes. Shared by every schedule-time picker (the
// Planning dialog and the werkbon sidebar), so both offer the same clock.
export const TIME_SLOTS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// Suggest eight hours after any valid HH:MM value. This also supports manually
// entered minutes that are not part of the 15-minute picker list.
export function suggestEndTime(startTime: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) return "";

  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Math.min(startMinutes + 8 * 60, 23 * 60 + 59);
  const hours = Math.floor(endMinutes / 60);
  const minutes = endMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
