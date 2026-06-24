import { STATUS_TONES, type StatusTone } from "../../theme/tokens";

// Employees (Medewerkers) — local display data. Demo data; wires to
// GET /api/employees.

export const KPIS: { label: string; value: number; tone: string }[] = [
  { label: "Totaal", value: 12, tone: "#1D1B20" },
  { label: "Monteurs", value: 8, tone: "#1D1B20" },
  { label: "Kantoor", value: 4, tone: "#1D1B20" },
  { label: "Actief", value: 10, tone: "#1E8E5A" },
];

export const FILTERS = ["Alle", "Monteurs", "Kantoor", "Inactief"];

export type EmpStatus = "actief" | "verlof" | "inactief";

export const STATUS: Record<EmpStatus, { label: string; tone: StatusTone }> = {
  actief: { label: "Actief", tone: STATUS_TONES.success },
  verlof: { label: "Verlof", tone: STATUS_TONES.warning },
  inactief: { label: "Inactief", tone: STATUS_TONES.neutral },
};

export type Employee = {
  initial: string;
  name: string;
  role: string;
  workOrders: number;
  status: EmpStatus;
};

export const ROWS: Employee[] = [
  { initial: "J", name: "Jan de Vries", role: "Senior Monteur", workOrders: 6, status: "actief" },
  { initial: "P", name: "Peter Bakker", role: "Monteur", workOrders: 23, status: "actief" },
  { initial: "M", name: "Maria Jansen", role: "Monteur", workOrders: 24, status: "actief" },
  { initial: "S", name: "Sara Kok", role: "Administratie", workOrders: 6, status: "actief" },
  { initial: "T", name: "Tom Hendriks", role: "Monteur", workOrders: 23, status: "verlof" },
  { initial: "L", name: "Lisa de Boer", role: "Kantoor", workOrders: 17, status: "inactief" },
];
