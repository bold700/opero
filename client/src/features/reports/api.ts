import { api } from "../../lib/api/client";

// Mirrors the backend reports aggregate (backend/src/modules/reports/routes.ts).
export type ReportsData = {
  kpis: {
    workOrders: number;
    hours: number;
    revenue: number;
    materialCosts: number;
  };
  chart: { week: string; value: number }[];
  recentReports: { id: string; date: string }[];
  topEmployees: { id: string; name: string; workOrderCount: number }[];
};

export function getReports(): Promise<ReportsData> {
  return api.get<ReportsData>("/reports");
}
