import { STATUS_TONES, type StatusTone } from "../../theme/tokens";

// Materials (Materialen) — local display data. Demo data; wires to
// GET /api/materials.

export const KPIS: { label: string; value: number; tone: string }[] = [
  { label: "Totaal items", value: 34, tone: "#6750A4" },
  { label: "Bijna op", value: 3, tone: "#B3261E" },
  { label: "Uitverkocht", value: 1, tone: "#B3261E" },
  { label: "In bestelling", value: 6, tone: "#B45309" },
];

export const FILTERS = ["Alle", "Voorraad OK", "Bijna op", "Uitverkocht", "Besteld"];

export type StockStatus = "ok" | "bijna_op" | "uitverkocht" | "besteld";

export const STATUS: Record<StockStatus, { label: string; tone: StatusTone }> = {
  ok: { label: "OK", tone: STATUS_TONES.success },
  bijna_op: { label: "Bijna op", tone: STATUS_TONES.danger },
  uitverkocht: { label: "Uitverkocht", tone: STATUS_TONES.danger },
  besteld: { label: "Besteld", tone: STATUS_TONES.warning },
};

export type Material = {
  color: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  status: StockStatus;
};

export const ROWS: Material[] = [
  { color: "#F59E0B", name: "Glaswol 50mm", category: "Isolatie", unit: "m²", stock: 240, minStock: 100, status: "ok" },
  { color: "#3B82F6", name: "Spouwmuurisolatie", category: "Isolatie", unit: "m²", stock: 85, minStock: 50, status: "ok" },
  { color: "#10B981", name: "PIR-platen 80mm", category: "Isolatie", unit: "m²", stock: 12, minStock: 20, status: "bijna_op" },
  { color: "#9333EA", name: "Vloerisolatie XPS", category: "Bevestiging", unit: "m²", stock: 0, minStock: 20, status: "uitverkocht" },
  { color: "#14B8A6", name: "Dampscherm folie", category: "Folie", unit: "m", stock: 320, minStock: 50, status: "ok" },
  { color: "#EAB308", name: "Mineraalwol 100mm", category: "Isolatie", unit: "m²", stock: 45, minStock: 40, status: "besteld" },
];
