// Planning — week calendar local data and layout constants. Demo data; wires to
// GET /api/planning.

export const HOUR_START = 8; // 08:00
export const HOUR_END = 18; // 18:00 (last row label 17:00)
export const HOUR_PX = 64;
export const TIME_COL = 64;

export const DAYS = [
  { label: "Ma", date: 16 },
  { label: "Di", date: 17 },
  { label: "Wo", date: 18 },
  { label: "Do", date: 19 },
  { label: "Vr", date: 20 },
  { label: "Za", date: 21 },
  { label: "Zo", date: 22 },
];

export type EventColor = "primary" | "info" | "success";

export const EVENT_COLOR: Record<EventColor, { bg: string; fg: string }> = {
  primary: { bg: "#6750A4", fg: "#FFFFFF" },
  info: { bg: "#3B82F6", fg: "#FFFFFF" },
  success: { bg: "#1E8E5A", fg: "#FFFFFF" },
};

export type CalEvent = {
  id: string;
  day: number; // index into DAYS
  start: number; // hour
  end: number; // hour
  customer: string;
  type: string;
  color: EventColor;
  address: string;
  monteur: string;
  status: string;
};

export const EVENTS: CalEvent[] = [
  { id: "e1", day: 1, start: 10, end: 12, customer: "Verhagen & Zn", type: "Bodemisolatie", color: "success", address: "Industrieweg 2, Rotterdam", monteur: "M. Jansen", status: "Bevestigd" },
  { id: "e2", day: 2, start: 9, end: 11, customer: "Bakker Vastgoed", type: "Vloerisolatie", color: "primary", address: "Kapteynstraat 12, Leiden", monteur: "J. de Vries", status: "Bevestigd" },
  { id: "e3", day: 2, start: 11, end: 13, customer: "De Pauw BV", type: "Dakisolatie", color: "info", address: "Hoofdweg 45, Haarlem", monteur: "P. Bakker", status: "Bevestigd" },
  { id: "e4", day: 2, start: 13, end: 17, customer: "Jan Smit", type: "Spouwmuur", color: "primary", address: "Dorpstraat 8, Utrecht", monteur: "J. de Vries", status: "Open" },
  { id: "e5", day: 3, start: 9, end: 11, customer: "M. Hendriks", type: "Vloerisolatie", color: "info", address: "Kerkstraat 12, Amsterdam", monteur: "P. Bakker", status: "Bevestigd" },
];

export const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
