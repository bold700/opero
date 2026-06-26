import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { getEmployees, type EmployeeRow } from "./api";
import { FILTERS, FILTER_LABEL_KEY, isOffice, type EmployeeFilter } from "./constants";
import { EmployeesActions } from "./components/EmployeesActions";
import { EmployeesKpis } from "./components/EmployeesKpis";
import { EmployeesTable } from "./components/EmployeesTable";

export function Employees() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<EmployeeFilter>("all");
  const { data, loading, error } = useApi<EmployeeRow[]>(getEmployees);

  const rows = data ?? [];

  const kpis = useMemo(
    () => [
      { label: t("employees.kpis.total"), value: rows.length, tone: "#1D1B20" },
      { label: t("employees.kpis.technicians"), value: rows.filter((r) => !isOffice(r.function)).length, tone: "#1D1B20" },
      { label: t("employees.kpis.office"), value: rows.filter((r) => isOffice(r.function)).length, tone: "#1D1B20" },
      { label: t("employees.kpis.active"), value: rows.filter((r) => r.status === "active").length, tone: "#1E8E5A" },
    ],
    [rows, t],
  );

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case "technicians":
        return rows.filter((r) => !isOffice(r.function));
      case "office":
        return rows.filter((r) => isOffice(r.function));
      case "inactive":
        return rows.filter((r) => r.status === "inactive");
      default:
        return rows;
    }
  }, [rows, activeFilter]);

  return (
    <PageLayout title={t("employees.title")} actions={<EmployeesActions />}>
      <EmployeesKpis kpis={kpis} />

      {/* Filter chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f === activeFilter;
          return (
            <Chip
              key={f}
              label={t(FILTER_LABEL_KEY[f])}
              onClick={() => setActiveFilter(f)}
              variant={active ? "filled" : "outlined"}
              sx={active ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 } : { color: "text.secondary" }}
            />
          );
        })}
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <EmployeesTable rows={filtered} />
      )}
    </PageLayout>
  );
}
