import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER } from "../../theme/tokens";
import { FILTERS } from "./constants";
import { EmployeesActions } from "./components/EmployeesActions";
import { EmployeesKpis } from "./components/EmployeesKpis";
import { EmployeesTable } from "./components/EmployeesTable";

// Employees (Medewerkers) list — M3 from the (orange) Figma. KPI cards (dashboard
// style) + a table with 3-state status. Demo data; wires to GET /api/employees.
export function Employees() {
  const [activeFilter, setActiveFilter] = useState("Alle");

  return (
    <PageLayout title="Medewerkers" actions={<EmployeesActions />}>
      <>
        {/* KPI cards */}
        <EmployeesKpis />

        {/* Filter chips */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = f === activeFilter;
            return (
              <Chip
                key={f}
                label={f}
                onClick={() => setActiveFilter(f)}
                variant={active ? "filled" : "outlined"}
                sx={active ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 } : { color: "text.secondary" }}
              />
            );
          })}
        </Box>

        {/* Table */}
        <EmployeesTable />
      </>
    </PageLayout>
  );
}
