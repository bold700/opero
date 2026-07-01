import Button from "@mui/material/Button";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { useTranslation } from "react-i18next";
import type { ReportsData } from "../api";

// Right-side action in the reports top bar: export the current figures to CSV.
// Disabled until the data has loaded.
export function ReportsActions({ data }: { data?: ReportsData | null }) {
  const { t } = useTranslation();

  const exportCsv = () => {
    if (!data) return;
    const rows: string[][] = [];
    rows.push([t("reports.export.section"), t("reports.export.metric"), t("reports.export.value")]);
    // KPIs
    rows.push([t("reports.kpis.workOrders"), "", String(data.kpis.workOrders)]);
    rows.push([t("reports.kpis.hours"), "", String(data.kpis.hours)]);
    rows.push([t("reports.kpis.revenue"), "", String(data.kpis.revenue)]);
    rows.push([t("reports.kpis.materialCosts"), "", String(data.kpis.materialCosts)]);
    // Weekly work orders
    data.chart.forEach((c) =>
      rows.push([t("reports.export.weekly"), c.week, String(c.value)]),
    );
    // Top employees
    data.topEmployees.forEach((e) =>
      rows.push([t("reports.export.topEmployees"), e.name, String(e.workOrderCount)]),
    );

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opero-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="contained"
      startIcon={<FileDownloadOutlinedIcon />}
      onClick={exportCsv}
      disabled={!data}
    >
      {t("reports.actions.export")}
    </Button>
  );
}
