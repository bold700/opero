import type { PlanningEntry } from "./api";
import { HOUR_START, HOUR_END, type CalEvent, type EventColor } from "./constants";

// `weekdayKey` is a translation key suffix (mon..sun); components render the
// localized short label via t(`planning.weekdays.${weekdayKey}`).
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type CalDay = { weekdayKey: WeekdayKey; date: number; iso: string };

const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Monday (00:00) of the week containing `d`.
function mondayOf(d: Date): Date {
  const day = d.getDay() || 7; // Sun=0 → 7
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseHour(time: string | null, fallback: number): number {
  if (!time) return fallback;
  const h = parseInt(time.slice(0, 2), 10);
  return Number.isFinite(h) ? h : fallback;
}

// Pick the week to display: the week of the earliest entry, else the current week.
export function weekStartFor(entries: PlanningEntry[]): Date {
  if (entries.length === 0) return mondayOf(new Date());
  const earliest = entries
    .map((e) => e.date)
    .sort()[0];
  return mondayOf(new Date(`${earliest}T00:00:00`));
}

// The 7 day columns (Mon–Sun) for a given week start.
export function weekDays(weekStart: Date): CalDay[] {
  return WEEKDAY_KEYS.map((weekdayKey, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return { weekdayKey, date: d.getDate(), iso: isoDate(d) };
  });
}

const COLORS: EventColor[] = ["primary", "info", "success"];

// Map API entries → calendar events positioned within the given week.
export function toCalEvents(entries: PlanningEntry[], days: CalDay[]): CalEvent[] {
  const isoToIndex = new Map(days.map((d, i) => [d.iso, i]));
  return entries
    .map((e, i): CalEvent | null => {
      const day = isoToIndex.get(e.date);
      if (day === undefined) return null;
      const start = parseHour(e.startTime, HOUR_START);
      const endRaw = parseHour(e.endTime, start + 2);
      const end = Math.min(Math.max(endRaw, start + 1), HOUR_END);
      return {
        id: `${e.projectId}-${e.date}`,
        day,
        start,
        end,
        customer: e.customerName,
        type: e.projectNumber,
        color: COLORS[i % COLORS.length],
        address: e.vehicle ?? "—",
        technician: e.teamLeaderId ?? "—",
        status: e.status,
      };
    })
    .filter((e): e is CalEvent => e !== null);
}

// Index of "today" within the week, or -1 if today isn't in this week.
export function todayIndexIn(days: CalDay[]): number {
  const today = isoDate(new Date());
  return days.findIndex((d) => d.iso === today);
}
