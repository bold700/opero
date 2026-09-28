import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import {
  PLANNING_TIMELINE,
  RADIUS,
  SPACING,
} from "../../../theme/tokens";
import type { PlanningEntry } from "../api";
import type { PlanningPeriod } from "./CalendarView";

const TIMELINE_START = 6 * 60;
const TIMELINE_END = 20 * 60;
const TIMELINE_DURATION = TIMELINE_END - TIMELINE_START;
const DEFAULT_START = 8 * 60;
const DEFAULT_DURATION = 8 * 60;
const MAX_SPAN_DAYS = 31;

type TimelineItem = {
  entry: PlanningEntry;
  date: string;
  startMinutes: number;
  endMinutes: number;
  lane: number;
  spanDay?: number;
  spanTotal?: number;
};

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getPeriodStart(date: Date, period: PlanningPeriod): Date {
  if (period === "week") return startOfWeek(date);
  if (period === "month") return startOfMonth(date);
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getPeriodEndExclusive(start: Date, period: PlanningPeriod): Date {
  if (period === "day") return addDays(start, 1);
  if (period === "week") return addDays(start, 7);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function movePeriod(date: Date, period: PlanningPeriod, direction: -1 | 1): Date {
  if (period === "day") return addDays(date, direction);
  if (period === "week") return addDays(date, direction * 7);
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}

function formatRangeLabel(
  start: Date,
  endExclusive: Date,
  period: PlanningPeriod,
  locale: string,
): string {
  if (period === "day") {
    return start.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (period === "month") {
    return start.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  return `${start.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  })} â€“ ${addDays(endExclusive, -1).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000,
  );
}

function minutesFromTime(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function expandEntries(entries: PlanningEntry[]): Omit<TimelineItem, "lane">[] {
  const datesByWorkOrder = new Map<string, Set<string>>();
  for (const entry of entries) {
    const dates = datesByWorkOrder.get(entry.workOrderId) ?? new Set<string>();
    dates.add(entry.date);
    datesByWorkOrder.set(entry.workOrderId, dates);
  }

  const expanded: Omit<TimelineItem, "lane">[] = [];
  for (const entry of entries) {
    const startMinutes = minutesFromTime(entry.startTime, DEFAULT_START);
    const parsedEnd = minutesFromTime(
      entry.endTime,
      startMinutes + DEFAULT_DURATION,
    );
    const endMinutes = parsedEnd > startMinutes ? parsedEnd : startMinutes + 60;
    const spanTotal = entry.plannedEndDate && entry.plannedEndDate > entry.date
      ? Math.min(daysBetween(entry.date, entry.plannedEndDate) + 1, MAX_SPAN_DAYS)
      : 1;

    for (let index = 0; index < spanTotal; index += 1) {
      const date = toIsoDate(addDays(parseIsoDate(entry.date), index));
      if (index > 0 && datesByWorkOrder.get(entry.workOrderId)?.has(date)) continue;
      expanded.push({
        entry,
        date,
        startMinutes,
        endMinutes,
        spanDay: spanTotal > 1 ? index + 1 : undefined,
        spanTotal: spanTotal > 1 ? spanTotal : undefined,
      });
    }
  }
  return expanded;
}

function placeInLanes(
  items: Omit<TimelineItem, "lane">[],
): TimelineItem[] {
  const laneEnds: number[] = [];
  return [...items]
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
    .map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMinutes);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.endMinutes;
      return { ...item, lane };
    });
}

export function TimelineView({
  events,
  period,
  anchorDate,
  locale,
  onDatesSet,
  onAnchorDateChange,
  onEventClick,
  onDateClick,
}: {
  events: PlanningEntry[];
  period: PlanningPeriod;
  anchorDate: string;
  locale: string;
  onDatesSet: (start: string, end: string) => void;
  onAnchorDateChange: (dateIso: string) => void;
  onEventClick: (entry: PlanningEntry) => void;
  onDateClick: (dateIso: string) => void;
}) {
  const { t } = useTranslation();
  const parsedAnchorDate = useMemo(() => parseIsoDate(anchorDate), [anchorDate]);
  const periodStart = useMemo(
    () => getPeriodStart(parsedAnchorDate, period),
    [parsedAnchorDate, period],
  );
  const periodEndExclusive = useMemo(
    () => getPeriodEndExclusive(periodStart, period),
    [period, periodStart],
  );
  const periodStartIso = toIsoDate(periodStart);
  const periodEndExclusiveIso = toIsoDate(periodEndExclusive);
  const days = useMemo(
    () =>
      Array.from(
        { length: daysBetween(periodStartIso, periodEndExclusiveIso) },
        (_, index) => addDays(periodStart, index),
      ),
    [periodEndExclusiveIso, periodStart, periodStartIso],
  );
  const expandedEntries = useMemo(() => expandEntries(events), [events]);
  const hourMarks = Array.from({ length: 15 }, (_, index) => TIMELINE_START + index * 60);

  useEffect(() => {
    onDatesSet(periodStartIso, periodEndExclusiveIso);
  }, [onDatesSet, periodEndExclusiveIso, periodStartIso]);

  const rangeLabel = formatRangeLabel(
    periodStart,
    periodEndExclusive,
    period,
    locale,
  );

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        p: { xs: 1.5, md: 2.5 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACING.itemGap,
          flexWrap: "wrap",
          mb: SPACING.sectionGap,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            aria-label={t("planning.timeline.previousPeriod")}
            onClick={() =>
              onAnchorDateChange(toIsoDate(movePeriod(periodStart, period, -1)))
            }
          >
            <ArrowBackIcon />
          </IconButton>
          <IconButton
            aria-label={t("planning.timeline.nextPeriod")}
            onClick={() =>
              onAnchorDateChange(toIsoDate(movePeriod(periodStart, period, 1)))
            }
          >
            <ArrowForwardIcon />
          </IconButton>
          <Button onClick={() => onAnchorDateChange(toIsoDate(new Date()))}>
            {t("planning.timeline.today")}
          </Button>
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {rangeLabel}
        </Typography>
      </Box>

      <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            minWidth: PLANNING_TIMELINE.dayLabelWidth + PLANNING_TIMELINE.minTrackWidth,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: `${PLANNING_TIMELINE.dayLabelWidth}px minmax(${PLANNING_TIMELINE.minTrackWidth}px, 1fr)`,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box />
            <Box sx={{ position: "relative", height: PLANNING_TIMELINE.eventHeight / 2 }}>
              {hourMarks.map((minutes, index) => (
                <Typography
                  key={minutes}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    position: "absolute",
                    left: `${((minutes - TIMELINE_START) / TIMELINE_DURATION) * 100}%`,
                    transform:
                      index === 0
                        ? "none"
                        : index === hourMarks.length - 1
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatTime(minutes)}
                </Typography>
              ))}
            </Box>
          </Box>

          {days.map((day) => {
            const date = toIsoDate(day);
            const dayItems = placeInLanes(
              expandedEntries.filter((item) => item.date === date),
            );
            const laneCount = Math.max(
              1,
              dayItems.reduce((maximum, item) => Math.max(maximum, item.lane + 1), 0),
            );
            const rowHeight =
              PLANNING_TIMELINE.rowPadding * 2 +
              laneCount * PLANNING_TIMELINE.eventHeight +
              (laneCount - 1) * PLANNING_TIMELINE.laneGap;

            return (
              <Box
                key={date}
                sx={{
                  display: "grid",
                  gridTemplateColumns: `${PLANNING_TIMELINE.dayLabelWidth}px minmax(${PLANNING_TIMELINE.minTrackWidth}px, 1fr)`,
                  minHeight: rowHeight,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ p: SPACING.itemGap }}>
                  <Typography sx={{ fontWeight: 700, textTransform: "capitalize" }}>
                    {day.toLocaleDateString(locale, { weekday: "short" })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {day.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  </Typography>
                </Box>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={t("planning.timeline.addOnDate", { date })}
                  onClick={() => onDateClick(date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onDateClick(date);
                  }}
                  sx={{ position: "relative", minHeight: rowHeight, cursor: "pointer" }}
                >
                  {hourMarks.map((minutes) => (
                    <Box
                      key={minutes}
                      aria-hidden
                      sx={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${((minutes - TIMELINE_START) / TIMELINE_DURATION) * 100}%`,
                        borderLeft: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                  ))}

                  {dayItems.map((item) => {
                    if (
                      item.endMinutes <= TIMELINE_START ||
                      item.startMinutes >= TIMELINE_END
                    ) {
                      return null;
                    }
                    const visibleStart = Math.max(item.startMinutes, TIMELINE_START);
                    const visibleEnd = Math.min(item.endMinutes, TIMELINE_END);
                    const left =
                      ((visibleStart - TIMELINE_START) / TIMELINE_DURATION) * 100;
                    const width = Math.max(
                      0,
                      ((visibleEnd - visibleStart) / TIMELINE_DURATION) * 100,
                    );
                    const context = [...new Set([
                      item.entry.workOrderTitle,
                      item.entry.projectName,
                    ].filter(Boolean))].join(" Â· ");

                    return (
                      <Box
                        key={`${item.entry.workOrderId}-${date}-${item.spanDay ?? 1}`}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEventClick(item.entry);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.stopPropagation();
                          onEventClick(item.entry);
                        }}
                        sx={{
                          position: "absolute",
                          left: `${left}%`,
                          top:
                            PLANNING_TIMELINE.rowPadding +
                            item.lane *
                              (PLANNING_TIMELINE.eventHeight + PLANNING_TIMELINE.laneGap),
                          width: `calc(${width}% - ${PLANNING_TIMELINE.eventGap}px)`,
                          minWidth: PLANNING_TIMELINE.eventMinWidth,
                          height: PLANNING_TIMELINE.eventHeight,
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          borderRadius: `${RADIUS.control}px`,
                          px: SPACING.itemGap,
                          py: SPACING.fieldLabelGap,
                          overflow: "hidden",
                          cursor: "pointer",
                          boxShadow: 1,
                          "&:hover": { bgcolor: "primary.dark" },
                        }}
                      >
                        <Typography variant="caption" color="inherit" sx={{ fontWeight: 700 }}>
                          {formatTime(item.startMinutes)} â€“ {formatTime(item.endMinutes)}
                        </Typography>
                        <Typography color="inherit" sx={{ fontWeight: 700 }} noWrap>
                          {item.entry.customerName}
                        </Typography>
                        <Typography variant="caption" color="inherit" noWrap sx={{ opacity: 0.9 }}>
                          {item.spanDay && item.spanTotal
                            ? `${t("planning.spanDay", {
                                day: item.spanDay,
                                total: item.spanTotal,
                              })} Â· `
                            : ""}
                          {context}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Card>
  );
}
