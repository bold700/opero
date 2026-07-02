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

// Hours with a language-appropriate unit: "160 u" (nl) / "160 h" (en). Pass the
// current i18n language.
export function formatHours(n: number, lang: string): string {
  const unit = lang.startsWith("nl") ? "u" : "h";
  return `${n} ${unit}`;
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

// --- Period helpers --------------------------------------------------------
// All periods are inclusive ISO date strings { from, to } (YYYY-MM-DD).

export type Period = { from: string; to: string };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// The month containing `ref` (default now) as a full-month period.
export function monthPeriod(ref = new Date()): Period {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  return {
    from: isoDate(new Date(Date.UTC(y, m, 1))),
    to: isoDate(new Date(Date.UTC(y, m + 1, 0))),
  };
}

// Shift a month period by ±1 month.
export function shiftMonth(period: Period, delta: number): Period {
  const start = new Date(`${period.from}T00:00:00Z`);
  return monthPeriod(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1)));
}

// Preset ranges for the dropdown.
export type PresetKey = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "allTime";

export function presetPeriod(key: PresetKey): Period {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (key) {
    case "thisMonth":
      return monthPeriod(now);
    case "lastMonth":
      return monthPeriod(new Date(Date.UTC(y, m - 1, 1)));
    case "thisQuarter": {
      const qStart = Math.floor(m / 3) * 3;
      return {
        from: isoDate(new Date(Date.UTC(y, qStart, 1))),
        to: isoDate(new Date(Date.UTC(y, qStart + 3, 0))),
      };
    }
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "allTime":
      // A wide, safe range that covers all realistic data.
      return { from: "2000-01-01", to: "2100-12-31" };
  }
}

// Human label for a period (used in the picker + saved-report defaults).
export function periodLabel(period: Period): string {
  const from = new Date(`${period.from}T00:00:00Z`);
  const to = new Date(`${period.to}T00:00:00Z`);
  // A full single calendar month → show "juli 2026".
  const isFullMonth =
    from.getUTCDate() === 1 &&
    to.getUTCMonth() === from.getUTCMonth() &&
    to.getUTCDate() === new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate();
  if (isFullMonth) {
    return from.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  }
  return `${formatDate(period.from)} – ${formatDate(period.to)}`;
}

export const PRESETS: PresetKey[] = ["thisMonth", "lastMonth", "thisQuarter", "thisYear", "allTime"];

// Which preset (if any) the given period currently matches — so the picker can
// show the active preset name + a checkmark. Returns null for an arbitrary month.
export function matchingPreset(period: Period): PresetKey | null {
  return PRESETS.find((key) => {
    const p = presetPeriod(key);
    return p.from === period.from && p.to === period.to;
  }) ?? null;
}

export const FILTER_CHIPS = ["all", "workOrders", "hours", "materials"] as const;
