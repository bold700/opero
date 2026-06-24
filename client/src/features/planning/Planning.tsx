import { useState } from "react";
import Box from "@mui/material/Box";
import { TopBar } from "../../components/PageLayout";
import { SURFACE, SPACING } from "../../theme/tokens";
import { EVENTS } from "./constants";
import { PlanningActions } from "./components/PlanningActions";
import { DetailsPanel } from "./components/DetailsPanel";
import { DayStrip } from "./components/DayStrip";
import { WeekGrid } from "./components/WeekGrid";

// Planning — week calendar, M3 from the (orange) Figma. Time grid with colored
// event blocks + a details side panel. Demo data; wires to GET /api/planning.
export function Planning() {
  const [view, setView] = useState("week");
  const [selectedId, setSelectedId] = useState("e2");
  const selected = EVENTS.find((e) => e.id === selectedId) ?? EVENTS[0];
  const todayIndex = 2; // Wo 18 highlighted

  return (
    <Box sx={{ bgcolor: SURFACE, minHeight: "100dvh" }}>
      <TopBar title="Planning" actions={<PlanningActions view={view} onView={setView} />} />

      <Box sx={{ display: "flex", alignItems: "stretch", minHeight: "calc(100dvh - 64px)" }}>
        {/* Calendar */}
        <Box sx={{ flex: 1, minWidth: 0, p: SPACING.pagePadding }}>
          {/* Month nav + day strip */}
          <DayStrip todayIndex={todayIndex} />

          {/* Week grid */}
          <WeekGrid todayIndex={todayIndex} selectedId={selectedId} onSelect={setSelectedId} />
        </Box>

        {/* Details side panel */}
        <DetailsPanel event={selected} />
      </Box>
    </Box>
  );
}
