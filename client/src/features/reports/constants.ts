import AssignmentIcon from "@mui/icons-material/Assignment";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EuroIcon from "@mui/icons-material/Euro";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import type { SvgIconComponent } from "@mui/icons-material";

// Reports (Rapporten) — local display data. Demo data; wires to GET /api/reports.

export const KPIS: { label: string; value: string; icon: SvgIconComponent }[] = [
  { label: "Werkbonnen", value: "47", icon: AssignmentIcon },
  { label: "Uren", value: "382u", icon: AccessTimeIcon },
  { label: "Omzet", value: "€28.400", icon: EuroIcon },
  { label: "Materiaalkosten", value: "€6.200", icon: Inventory2Icon },
];

export const CHART = [
  { week: "W21", value: 28 },
  { week: "W22", value: 42 },
  { week: "W23", value: 34 },
  { week: "W24", value: 56 },
  { week: "W25", value: 52 },
];
export const CHART_MAX = 60;

export const REPORTS = [
  { id: "#121", date: "11 Jun 2025" },
  { id: "#122", date: "12 Jun 2025" },
  { id: "#123", date: "13 Jun 2025" },
  { id: "#124", date: "14 Jun 2025" },
  { id: "#125", date: "15 Jun 2025" },
];

export const TOP = [
  { initial: "M", name: "Marco van den Berg", workOrders: 12, hours: "160u" },
  { initial: "J", name: "Jan-Willem de Boer", workOrders: 10, hours: "145u" },
  { initial: "P", name: "Peter Bakker", workOrders: 9, hours: "132u" },
];
