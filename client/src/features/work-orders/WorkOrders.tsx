import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { PageLayout } from "../../components/PageLayout";
import { LAVENDER, RADIUS } from "../../theme/tokens";
import { COUNTS, FILTERS } from "./constants";
import { WorkOrdersActions } from "./components/WorkOrdersActions";
import { WorkOrdersTable } from "./components/WorkOrdersTable";

// Work orders (Werkbonnen) list — rebuilt in M3 from the (orange) Figma:
// summary counts, filter chips, a table, pagination. Demo data for now; wires to
// GET /api/work-orders once auth is connected. Dutch strings inline (i18n later).
export function WorkOrders() {
  const [activeFilter, setActiveFilter] = useState("Alle");

  return (
    <PageLayout title="Werkbonnen" actions={<WorkOrdersActions />}>
      <>
        {/* Summary counts */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {COUNTS.map((c) => (
            <Box
              key={c.label}
              sx={{
                px: 2,
                py: 1,
                borderRadius: `${RADIUS.control}px`,
                bgcolor: "#FFFFFF",
                border: "1px solid",
                borderColor: "divider",
                fontSize: 14,
                fontWeight: 600,
                color: c.tone,
              }}
            >
              {c.label}: {c.value}
            </Box>
          ))}
        </Box>

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
        <WorkOrdersTable />
      </>
    </PageLayout>
  );
}
