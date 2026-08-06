// 24-hour time slots in 15-minute steps (00:00 … 23:45) — European clock, no
// AM/PM, no arbitrary minutes. Shared by every schedule-time picker (the
// Planning dialog and the werkbon sidebar), so both offer the same clock.
export const TIME_SLOTS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// "HH:MM" strings compare correctly as strings; +8 slots = two hours later.
// Used to suggest an end time when a new start would pass the current end.
export function suggestEndTime(startTime: string): string {
  const idx = TIME_SLOTS.indexOf(startTime);
  return TIME_SLOTS[Math.min(idx + 8, TIME_SLOTS.length - 1)];
}
