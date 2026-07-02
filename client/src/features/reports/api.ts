import { api } from "../../lib/api/client";

export type ReportFilter = "all" | "workOrders" | "hours" | "materials";

// Mirrors the backend reports aggregate (backend/src/modules/reports/routes.ts).
export type ReportsData = {
  period: { from: string; to: string };
  kpis: {
    workOrders: number;
    hours: number;
    revenue: number;
    materialCosts: number;
  };
  chart: { week: string; value: number }[];
  recentWorkOrders: {
    id: string;
    label: string;
    customer: string;
    date: string;
    signed: boolean;
  }[];
  topEmployees: { id: string; name: string; workOrderCount: number; hours: number }[];
};

export function getReports(from: string, to: string): Promise<ReportsData> {
  return api.get<ReportsData>(`/reports?from=${from}&to=${to}`);
}
