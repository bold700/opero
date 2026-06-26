import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { TopBar } from "../../components/PageLayout";
import { SURFACE, SPACING } from "../../theme/tokens";
import { useApi } from "../../lib/api/useApi";
import { getPlanning, type PlanningEntry } from "./api";
import { weekStartFor, weekDays, toCalEvents, todayIndexIn } from "./transform";
import { PlanningActions } from "./components/PlanningActions";
import { DetailsPanel } from "./components/DetailsPanel";
import { DayStrip } from "./components/DayStrip";
import { WeekGrid } from "./components/WeekGrid";

// Translation key suffixes for month names, indexed by Date.getMonth().
const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function Planning() {
  const { t } = useTranslation();
  const [view, setView] = useState("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, loading, error } = useApi<PlanningEntry[]>(() => getPlanning());

  const entries = useMemo(() => data ?? [], [data]);
  const weekStart = useMemo(() => weekStartFor(entries), [entries]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const events = useMemo(() => toCalEvents(entries, days), [entries, days]);
  const todayIndex = todayIndexIn(days);
  const monthLabel = `${t(`planning.months.${MONTH_KEYS[weekStart.getMonth()]}`)} ${weekStart.getFullYear()}`;

  const selected = events.find((e) => e.id === selectedId) ?? events[0] ?? null;

  return (
    <Box sx={{ bgcolor: SURFACE, minHeight: "100dvh" }}>
      <TopBar title={t("planning.title")} actions={<PlanningActions view={view} onView={setView} />} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: SPACING.pagePadding }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "stretch", minHeight: "calc(100dvh - 64px)" }}>
          {/* Calendar */}
          <Box sx={{ flex: 1, minWidth: 0, p: SPACING.pagePadding }}>
            <DayStrip days={days} monthLabel={monthLabel} todayIndex={todayIndex} />
            <WeekGrid days={days} events={events} todayIndex={todayIndex} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </Box>

          {/* Details side panel */}
          {selected ? (
            <DetailsPanel event={selected} />
          ) : (
            <Box sx={{ width: 320, flexShrink: 0, p: SPACING.pagePadding, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider" }}>
              <Typography color="text.secondary">{t("planning.emptyWeek")}</Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
