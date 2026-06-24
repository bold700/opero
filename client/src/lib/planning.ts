export function startOfIsoWeek(reference: Date) {
  const date = new Date(reference);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

export function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekDays(start: Date, count = 6) {
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function isoWeekNumber(reference: Date) {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const diff = (date.getTime() - yearStart.getTime()) / 86400000;
  return Math.ceil((diff + 1) / 7);
}

export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short" }).format(date);
}

export function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(date);
}
