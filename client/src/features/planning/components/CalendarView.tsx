import { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, {
  type DateClickArg,
} from "@fullcalendar/interaction";
import type {
  EventClickArg,
  EventDropArg,
  DatesSetArg,
  EventInput,
} from "@fullcalendar/core";
import { Card } from "../../../components/Card";
import type { PlanningEntry } from "../api";

export type CalendarViewName =
  | "dayGridMonth"
  | "timeGridWeek"
  | "timeGridDay"
  | "listWeek";

// Default slot for a job scheduled on a date with no time yet — so it still
// appears in the time grid (we don't use an all-day row).
const DEFAULT_START = "08:00";
const DEFAULT_END = "10:00";

// One planning entry → a FullCalendar event. The entry's projectId + date make a
// stable id; the original entry rides along in extendedProps for the panel.
function toEvent(e: PlanningEntry): EventInput {
  const startTime = e.startTime ?? DEFAULT_START;
  const endTime = e.endTime ?? (e.startTime ? undefined : DEFAULT_END);
  return {
    id: `${e.projectId}-${e.date}`,
    title: e.customerName,
    start: `${e.date}T${startTime}`,
    end: endTime ? `${e.date}T${endTime}` : undefined,
    allDay: false,
    extendedProps: { entry: e },
  };
}

// FullCalendar wrapper: views, navigation, and interaction wired to callbacks.
// The parent owns data (events) + reacts to the visible window via onDatesSet.
export function CalendarView({
  events,
  view,
  locale,
  editable,
  onDatesSet,
  onEventClick,
  onDateClick,
  onEventDrop,
}: {
  events: PlanningEntry[];
  view: CalendarViewName;
  locale: string;
  editable: boolean;
  onDatesSet: (start: string, end: string) => void;
  onEventClick: (entry: PlanningEntry) => void;
  onDateClick: (dateIso: string) => void;
  onEventDrop: (entry: PlanningEntry, newDate: string, newStart?: string, newEnd?: string) => void;
}) {
  const ref = useRef<FullCalendar>(null);

  // Toolbar toggle changes `view` → tell FullCalendar imperatively.
  useEffect(() => {
    ref.current?.getApi().changeView(view);
  }, [view]);

  return (
    <Card
      sx={{
        p: { xs: 1.5, md: 2.5 },
        // Fill the available height and let the calendar scroll inside itself
        // instead of growing the page.
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        // ── Mobile: let the toolbar (prev/next/today + title) wrap instead of
        // overflowing the narrow card, and tighten spacing so week/day grids and
        // the time-axis stay usable at ~360px. ──
        "& .fc .fc-toolbar.fc-header-toolbar": { flexWrap: "wrap", rowGap: "8px" },
        "@media (max-width:600px)": {
          "& .fc .fc-toolbar-title": { fontSize: "0.9rem" },
          "& .fc .fc-button": { padding: "4px 10px", fontSize: 12 },
          // Narrow the time-axis gutter so day/week columns get more width.
          "& .fc .fc-timegrid-axis-cushion, & .fc .fc-timegrid-slot-label-cushion": { fontSize: 10, px: 0.5 },
          "& .fc .fc-col-header-cell-cushion": { fontSize: 11 },
        },
        // ── Theme FullCalendar to the app design system (M3 / lavender) ──
        "& .fc": {
          flex: 1,
          minHeight: 0,
          "--fc-border-color": "#EEEAF2",
          "--fc-today-bg-color": "#F8F4FD",
          "--fc-page-bg-color": "transparent",
          "--fc-neutral-bg-color": "#FAFAFB",
          "--fc-now-indicator-color": "#E0524A",
          fontFamily: "inherit",
          fontSize: 13,
        },

        // ── Toolbar ──
        "& .fc-toolbar.fc-header-toolbar": { mb: 2.5 },
        "& .fc-toolbar-title": { fontSize: "1rem", fontWeight: 700, color: "text.primary" },
        "& .fc .fc-toolbar-chunk": { display: "flex", alignItems: "center", gap: "8px" },
        "& .fc .fc-button": {
          textTransform: "none",
          fontWeight: 600,
          fontSize: 13,
          lineHeight: 1.4,
          borderRadius: "999px",
          boxShadow: "none",
          padding: "5px 14px",
        },
        "& .fc .fc-button-primary": {
          bgcolor: "#F3EEFB",
          borderColor: "#F3EEFB",
          color: "#6750A4",
          "&:hover": { bgcolor: "#E8DEF8", borderColor: "#E8DEF8", color: "#21005D" },
          "&:focus, &:focus-visible": { boxShadow: "none", outline: "none" },
          "&:disabled": { bgcolor: "#F5F4F7", borderColor: "#F5F4F7", color: "#C4BFCC" },
        },
        "& .fc .fc-button-primary:not(:disabled).fc-button-active": {
          bgcolor: "#E8DEF8",
          borderColor: "#E8DEF8",
          color: "#21005D",
        },
        // prev/next as compact icon buttons sitting together.
        "& .fc .fc-prev-button, & .fc .fc-next-button": { padding: "5px 10px" },

        // ── Grid frame & lines ──
        "& .fc-theme-standard td, & .fc-theme-standard th": { borderColor: "#EEEAF2" },
        "& .fc .fc-scrollgrid": { borderRadius: "10px", overflow: "hidden", borderColor: "#EEEAF2" },
        "& .fc-theme-standard .fc-scrollgrid": { borderLeft: 0, borderTop: 0 },

        // ── Column headers (Mon 6/22 …) ──
        "& .fc .fc-col-header-cell": { py: 1.25, bgcolor: "#FCFBFD" },
        "& .fc .fc-col-header-cell-cushion": {
          color: "text.secondary",
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: "0.2px",
          textDecoration: "none",
          py: 0.5,
        },
        "& .fc .fc-day-today .fc-col-header-cell-cushion": { color: "#6750A4", fontWeight: 700 },

        // ── Scrollbar: always visible + styled, so it's obvious the time grid
        // scrolls. The time-grid body scroller is .fc-scroller. ──
        "& .fc .fc-scroller-liquid-absolute, & .fc .fc-timegrid-body .fc-scroller": {
          overflowY: "scroll !important",
        },
        "& .fc .fc-scroller::-webkit-scrollbar": { width: "12px" },
        "& .fc .fc-scroller::-webkit-scrollbar-track": {
          background: "#F4F2F7",
          borderRadius: "8px",
        },
        "& .fc .fc-scroller::-webkit-scrollbar-thumb": {
          background: "#C9C2DC",
          borderRadius: "8px",
          border: "3px solid #F4F2F7",
          "&:hover": { background: "#6750A4" },
        },
        // Firefox
        "& .fc .fc-scroller": { scrollbarWidth: "thin", scrollbarColor: "#C9C2DC #F4F2F7" },

        // ── Time grid: even rows, aligned labels ──
        "& .fc .fc-timegrid-slot": { height: "46px" },
        "& .fc .fc-timegrid-slot-minor": { borderTopStyle: "none" },
        "& .fc .fc-timegrid-slot-label": { verticalAlign: "top" },
        "& .fc .fc-timegrid-slot-label-cushion": {
          color: "text.secondary",
          fontSize: 11,
          fontWeight: 500,
          px: 1,
          mt: "-7px", // nudge the label to sit on the gridline
        },
        "& .fc .fc-timegrid-axis-cushion": { color: "text.secondary", fontSize: 11, fontWeight: 500 },
        // The all-day row + its divider — a clean single hairline, no stray line.
        "& .fc .fc-timegrid-divider": { padding: 0, borderColor: "#EEEAF2", borderWidth: "1px 0 0" },
        "& .fc .fc-daygrid-body .fc-day-disabled, & .fc .fc-timegrid-axis": { bgcolor: "transparent" },

        // ── now-indicator: sits ABOVE events, a clean line + a dot on the axis ──
        "& .fc .fc-timegrid-now-indicator-line": {
          borderWidth: "2px 0 0",
          borderColor: "#E0524A",
          zIndex: 6,
        },
        "& .fc .fc-timegrid-now-indicator-arrow": {
          left: 0,
          marginTop: "-4px",
          width: 8,
          height: 8,
          borderRadius: "50%",
          border: "none",
          background: "#E0524A",
          zIndex: 6,
        },

        // ── Events ──
        // The harness fills its column exactly. We strip ALL of FullCalendar's
        // own event chrome (bg, border, padding) and render our own chip via
        // eventContent — the chip uses inset:0 so it always fills the harness.
        "& .fc-timegrid-event, & .fc-timegrid-event .fc-event-main, & .fc-daygrid-event": {
          background: "transparent !important",
          border: "0 !important",
          boxShadow: "none !important",
          padding: "0 !important",
        },
        // THE FIX (verified against FullCalendar's source): the events layer has
        //   .fc-timegrid-col-events { margin: 0 2.5% 0 2px }
        // i.e. a 2.5% right + 2px left margin (the now-indicator container has
        // margin 0, which is why the red line is full-width and the chip isn't).
        // High-specificity override so it wins regardless of CSS load order.
        "& .fc .fc-timegrid-col-frame .fc-timegrid-col-events": {
          marginLeft: "0 !important",
          marginRight: "0 !important",
        },
        "& .fc-timegrid-event-harness": { zIndex: 3 },
        // our chip — flush to the harness (which now fills the column), so the
        // event is exactly as wide as the column, like the now-indicator line.
        "& .fc-event .opero-chip": {
          position: "absolute",
          inset: "1px 0",
          background: "#6750A4",
          color: "#FFFFFF",
          borderRadius: "8px",
          padding: "4px 8px",
          boxShadow: "0 1px 4px rgba(103,80,164,0.28)",
          cursor: "pointer",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "1px",
        },
        "& .fc-event:hover .opero-chip": { background: "#5840A0" },
        "& .opero-chip-time": { fontWeight: 600, fontSize: 12, opacity: 0.92 },
        "& .opero-chip-title": { fontWeight: 700, fontSize: 13, lineHeight: 1.25 },

        // ── Month view ──
        "& .fc .fc-daygrid-day-frame": { padding: "2px" },
        "& .fc .fc-daygrid-day-number": { color: "text.secondary", fontSize: 12, fontWeight: 500, py: 0.5, px: 1 },
        "& .fc .fc-day-today .fc-daygrid-day-number": { color: "#6750A4", fontWeight: 700 },
        "& .fc .fc-daygrid-more-link": { color: "#6750A4", fontWeight: 600, fontSize: 11 },

        // ── List view ──
        "& .fc .fc-list": { borderRadius: "10px", overflow: "hidden", border: "1px solid #EEEAF2" },
        "& .fc .fc-list-day-cushion": { bgcolor: "#FAFAFB", fontWeight: 600 },
        "& .fc .fc-list-event:hover td": { bgcolor: "#F8F4FD" },
        "& .fc .fc-list-event-dot": { borderColor: "#6750A4" },
      }}
    >
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={view}
        // The page drives the view via the toolbar; hide FC's built-in switcher.
        headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        locale={locale}
        firstDay={1}
        height="100%"
        nowIndicator
        // Month cells are small (especially on a phone) — cap events per day and
        // show a themed "+N" link instead of overflowing the cell.
        dayMaxEvents={3}
        // Full 24-hour day, European 24-hour clock everywhere. No all-day row —
        // every job has a time (date-only jobs get a default slot in toEvent).
        allDaySlot={false}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="07:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        // A single event fills the full column (no reserved right "overlap" gutter).
        slotEventOverlap={false}
        eventDurationEditable={editable}
        editable={editable}
        // Render our own chip — guarantees the visual fills the harness (inset:0).
        eventContent={(arg) => (
          <div className="opero-chip">
            {arg.timeText ? <span className="opero-chip-time">{arg.timeText}</span> : null}
            <span className="opero-chip-title">{arg.event.title}</span>
          </div>
        )}
        events={events.map(toEvent)}
        datesSet={(arg: DatesSetArg) =>
          onDatesSet(arg.startStr.slice(0, 10), arg.endStr.slice(0, 10))
        }
        eventClick={(arg: EventClickArg) =>
          onEventClick(arg.event.extendedProps.entry as PlanningEntry)
        }
        dateClick={(arg: DateClickArg) => onDateClick(arg.dateStr.slice(0, 10))}
        eventDrop={(arg: EventDropArg) => {
          const entry = arg.event.extendedProps.entry as PlanningEntry;
          const start = arg.event.start;
          if (!start) return;
          const dateIso = arg.event.startStr.slice(0, 10);
          const hhmm = arg.event.allDay
            ? undefined
            : `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
          const endHhmm = arg.event.end && !arg.event.allDay
            ? `${String(arg.event.end.getHours()).padStart(2, "0")}:${String(arg.event.end.getMinutes()).padStart(2, "0")}`
            : undefined;
          onEventDrop(entry, dateIso, hhmm, endHhmm);
        }}
      />
    </Card>
  );
}
