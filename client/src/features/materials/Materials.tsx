import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER } from "../../theme/tokens";
import { FILTERS } from "./constants";
import { MaterialsActions } from "./components/MaterialsActions";
import { MaterialsKpis } from "./components/MaterialsKpis";
import { MaterialsTable } from "./components/MaterialsTable";

// Materials (Materialen) list — M3 from the (orange) Figma. KPI cards + table
// with stock status. Demo data; wires to GET /api/materials.
export function Materials() {
  const [activeFilter, setActiveFilter] = useState("Alle");

  return (
    <PageLayout title="Materialen" actions={<MaterialsActions />}>
      <>
        {/* KPI cards */}
        <MaterialsKpis />

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
        <MaterialsTable />
      </>
    </PageLayout>
  );
}
