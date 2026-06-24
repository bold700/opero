import { STATUS_TONES, type StatusTone } from "../../theme/tokens";

// Work orders (Werkbonnen) — local display data. Demo data for now; wires to
// GET /api/work-orders once auth is connected. Dutch strings inline (i18n later).

export type StatusKey = "open" | "onderweg" | "spoed" | "klaar";

export const STATUS: Record<StatusKey, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: STATUS_TONES.open },
  onderweg: { label: "Onderweg", tone: STATUS_TONES.info },
  spoed: { label: "Spoed", tone: STATUS_TONES.danger },
  klaar: { label: "Klaar", tone: STATUS_TONES.success },
};

export const COUNTS: { label: string; value: number; tone: string }[] = [
  { label: "Totaal", value: 47, tone: "#49454F" },
  { label: "Open", value: 12, tone: "#6750A4" },
  { label: "Onderweg", value: 8, tone: "#3B82F6" },
  { label: "Spoed", value: 3, tone: "#B3261E" },
  { label: "Klaar", value: 24, tone: "#1E8E5A" },
];

export const FILTERS = ["Alle", "Open", "Onderweg", "Spoed", "Klaar deze week"];

export type Row = {
  number: string;
  customer: string;
  location: string;
  type: string;
  monteur: string;
  status: StatusKey;
  date: string;
};

export const ROWS: Row[] = [
  { number: "#WB-2024-089", customer: "Bakker Vastgoed", location: "Leiden", type: "Vloerisolatie", monteur: "J. de Vries", status: "open", date: "18 jun" },
  { number: "#WB-2024-088", customer: "De Pauw BV", location: "Haarlem", type: "Dakisolatie", monteur: "P. Bakker", status: "onderweg", date: "18 jun" },
  { number: "#WB-2024-087", customer: "Jan Smit", location: "Utrecht", type: "Spouwmuur", monteur: "J. de Vries", status: "spoed", date: "18 jun" },
  { number: "#WB-2024-086", customer: "Verhagen & Zn", location: "Rotterdam", type: "Bodemisolatie", monteur: "M. Jansen", status: "klaar", date: "17 jun" },
  { number: "#WB-2024-085", customer: "M. Hendriks", location: "Amsterdam", type: "Vloerisolatie", monteur: "P. Bakker", status: "open", date: "17 jun" },
  { number: "#WB-2024-084", customer: "R. Kok", location: "Den Haag", type: "Dakisolatie", monteur: "M. Jansen", status: "open", date: "16 jun" },
];
