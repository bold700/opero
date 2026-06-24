// Dashboard-local display helpers.

export const TONE = {
  primary: "#6750A4",
  info: "#3B82F6",
  danger: "#B3261E",
  success: "#1E8E5A",
  neutral: "#49454F",
} as const;

// English status value → Dutch display label.
export const STATUS_LABEL: Record<string, string> = {
  sales: "Verkoop",
  operations: "Operatie",
  closing: "Afronding",
};

export function euro(n: number): string {
  return `€ ${n.toLocaleString("nl-NL")}`;
}
