import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { HOURS, EVENT_COLOR, HOUR_START, HOUR_PX, TIME_COL, type CalEvent } from "../constants";
import type { CalDay } from "../transform";

// The week time grid: day header, time column, and absolutely-positioned events.
export function WeekGrid({
  days,
  events,
  todayIndex,
  selectedId,
  onSelect,
}: {
  days: CalDay[];
  events: CalEvent[];
  todayIndex: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card noPadding>
      {/* Day header row */}
      <Box sx={{ display: "flex", borderBottom: "1px solid", borderColor: "#F0EDF1" }}>
        <Box sx={{ width: TIME_COL, flexShrink: 0 }} />
        {days.map((d, i) => (
          <Box key={d.iso} sx={{ flex: 1, textAlign: "center", py: 1.5, borderLeft: "1px solid", borderColor: "#F0EDF1", color: i === todayIndex ? "primary.main" : "text.secondary" }}>
            <Typography variant="body2" sx={{ fontWeight: i === todayIndex ? 700 : 500 }}>
              {t(`planning.weekdays.${d.weekdayKey}`)} {d.date}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Grid body: time labels + day columns with absolutely-positioned events */}
      <Box sx={{ display: "flex", position: "relative" }}>
        {/* Time column */}
        <Box sx={{ width: TIME_COL, flexShrink: 0 }}>
          {HOURS.map((h) => (
            <Box key={h} sx={{ height: HOUR_PX, position: "relative" }}>
              <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", top: -8, right: 8 }}>
                {String(h).padStart(2, "0")}:00
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Day columns */}
        {days.map((d, dayIdx) => (
          <Box key={d.iso} sx={{ flex: 1, position: "relative", borderLeft: "1px solid", borderColor: "#F0EDF1" }}>
            {/* hour cells */}
            {HOURS.map((h) => (
              <Box key={h} sx={{ height: HOUR_PX, borderBottom: "1px solid", borderColor: "#F7F5F8" }} />
            ))}
            {/* events for this day */}
            {events.filter((e) => e.day === dayIdx).map((e) => {
              const c = EVENT_COLOR[e.color];
              const top = (e.start - HOUR_START) * HOUR_PX;
              const height = (e.end - e.start) * HOUR_PX;
              const active = e.id === selectedId;
              return (
                <Box
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  sx={{
                    position: "absolute",
                    top: top + 2,
                    left: 4,
                    right: 4,
                    height: height - 4,
                    bgcolor: c.bg,
                    color: c.fg,
                    borderRadius: 1.5,
                    p: 1,
                    cursor: "pointer",
                    overflow: "hidden",
                    outline: active ? "2px solid #1D1B20" : "none",
                    outlineOffset: 1,
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{e.customer}</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.9 }}>{e.type}</Typography>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Card>
  );
}
