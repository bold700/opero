// Dashboard-local display helpers.

export const TONE = {
  primary: "#6750A4",
  info: "#3B82F6",
  danger: "#B3261E",
  success: "#1E8E5A",
  neutral: "#49454F",
} as const;

// English status value → i18n translation key (translate at call site).
export const STATUS_LABEL_KEY: Record<string, string> = {
  sales: "dashboard.status.sales",
  operations: "dashboard.status.operations",
  closing: "dashboard.status.closing",
};

export function euro(n: number): string {
  return `€ ${n.toLocaleString("nl-NL")}`;
}
