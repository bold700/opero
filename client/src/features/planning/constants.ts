// Planning — week calendar local data and layout constants. Demo data; wires to
// GET /api/planning.

export const HOUR_START = 8; // 08:00
export const HOUR_END = 18; // 18:00 (last row label 17:00)
export const HOUR_PX = 64;
export const TIME_COL = 64;

export type EventColor = "primary" | "info" | "success";

export const EVENT_COLOR: Record<EventColor, { bg: string; fg: string }> = {
  primary: { bg: "#6750A4", fg: "#FFFFFF" },
  info: { bg: "#3B82F6", fg: "#FFFFFF" },
  success: { bg: "#1E8E5A", fg: "#FFFFFF" },
};

export type CalEvent = {
  id: string;
  day: number; // index into the week's day columns
  start: number; // hour
  end: number; // hour
  customer: string;
  type: string;
  color: EventColor;
  address: string;
  technician: string;
  status: string;
};

export const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
