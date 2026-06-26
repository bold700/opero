import AssignmentIcon from "@mui/icons-material/Assignment";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EuroIcon from "@mui/icons-material/Euro";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import type { SvgIconComponent } from "@mui/icons-material";

// Display metadata for the report KPI cards (i18n label key + icon, paired with
// the live value from the API). `labelKey` resolves to a "reports.kpis.<key>"
// string at render time — never translate at module top-level.
export const KPI_META: { key: "workOrders" | "hours" | "revenue" | "materialCosts"; labelKey: string; icon: SvgIconComponent }[] = [
  { key: "workOrders", labelKey: "reports.kpis.workOrders", icon: AssignmentIcon },
  { key: "hours", labelKey: "reports.kpis.hours", icon: AccessTimeIcon },
  { key: "revenue", labelKey: "reports.kpis.revenue", icon: EuroIcon },
  { key: "materialCosts", labelKey: "reports.kpis.materialCosts", icon: Inventory2Icon },
];

export function euro(n: number): string {
  return `€ ${n.toLocaleString("nl-NL")}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}
