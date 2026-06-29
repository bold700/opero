# Planning — full calendar, end to end (comprehensive plan)

The current screen is a custom **week-only** grid with a **fake day/week/month
toggle** (the toggle sets state that's never read — it always renders the week
grid), no navigation, no scheduling, and two data bugs. This replaces it with a
real, feature-complete calendar.

**Spec (Planning):** Calendar Overview · Day/Week/Month View · Schedule Task ·
Route Overview. Every backend endpoint already exists.

---

## Decision: FullCalendar

Use **FullCalendar** (`@fullcalendar/react` + day/timegrid/list plugins).
- Officially supports React 19 (`^16 || ^17 || ^18 || ^19`) — no version conflict.
  *(If any peer-dep ever fought React 19, we pin React to the supported version
  — version is not a blocker.)*
- Gives **day / week / month / list** views, prev/next/today navigation,
  click-to-create, drag-to-move/resize, event rendering — out of the box.
- We style it to the app's theme (lavender accents, M3 surfaces) via its CSS
  hooks; keep the right-hand **details panel** as our own component.

We **delete** the custom calendar internals: `WeekGrid`, `DayStrip`,
`transform.ts` grid math, the `HOUR_*`/`TIME_COL` constants. Keep `DetailsPanel`
(reworked) and `PlanningActions` (reworked — FullCalendar drives view/nav, so the
toggle becomes real).

---

## Backend surface (all exists — wire to these)

| Action | Endpoint |
|---|---|
| Calendar feed (window) | `GET /planning?from=&to=` |
| Schedule / reschedule a project | `POST /projects/:id/planning {date, teamLeaderId?, startTime?, endTime?, vehicle?}` |
| Change duration (days) | `PATCH /projects/:id/planning {days}` |
| Unschedule | `DELETE /projects/:id/planning` |
| Route overview (per day) | `GET /planning/route?date=` |

**Two DTO fixes needed (the data bugs at the source):** the planning entry sends
`teamLeaderId` (a uuid) and no address. Extend the DTO to include
`teamLeaderName` + project `address`/`city`. (Part A below.)

---

## THE PLAN — phases

### Phase 1 — Backend: fix the planning entry DTO
So the calendar shows real data, not a uuid / the vehicle as the address.
- Extend `planningProjectInclude`: load `address`, `city`, project `teamLeader {name}`,
  and per-`PlanningItem` `teamLeader {name}`.
- Add to `PlanningEntry`: `address`, `city`, `teamLeaderName`. Keep `vehicle`
  distinct (it's a real field, just not the address).
- Verify with curl: a scheduled project returns a real address + technician name.

### Phase 2 — Install + mount FullCalendar
- Add deps: `@fullcalendar/react`, `@fullcalendar/daygrid`,
  `@fullcalendar/timegrid`, `@fullcalendar/list`, `@fullcalendar/interaction`.
- New `CalendarView` component: feeds events from `GET /planning`, maps each
  `PlanningEntry` → a FullCalendar event (`{ id, title, start, end, extendedProps }`).
- Views: **dayGridMonth · timeGridWeek · timeGridDay · listWeek**. Wire the
  existing day/week/month toggle (+ a list option) to `calendar.changeView`.
- Navigation: prev / next / today driven by FullCalendar's API; the visible
  `[from,to]` window refetches the feed on `datesSet`.
- Theme it: lavender selected/today, M3 surfaces, our typography. Localize
  (NL/EN) via FullCalendar's `locale` from i18n.

### Phase 3 — Schedule / reschedule (the interactive core)
- **Click an empty slot / "Nieuwe afspraak"** → schedule dialog: pick an
  unscheduled project (dropdown), date (prefilled from the click), team leader,
  start/end time → `POST /projects/:id/planning`. Refetch.
- **Drag an event** to a new day/time, or **resize** it → `POST /planning`
  (reschedule) / `PATCH` (duration). Optimistic refetch.
- **Click an event** → details panel (right) with: customer, project number,
  address, technician, time, status, + actions:
  - **Werkbon openen** → navigate to the work order / project.
  - **Bewerken** → the schedule dialog, pre-filled.
  - **Verwijderen uit planning** → `DELETE /projects/:id/planning`.

### Phase 4 — Route Overview (spec item, currently absent)
- A **"Route" view/tab**: for the selected day, the ordered list of jobs
  (`GET /planning/route?date=`) — customer, address, time. The field-day list a
  monteur follows. (Backend exists; just a list UI.)

### Phase 5 — Roles, polish, empty states
- **admin:** full — create/drag/edit/delete/route.
- **technician:** read-only, own jobs (backend scopes the feed already); drag &
  scheduling hidden.
- **client:** no access (nav already hides it).
- Loading / empty-week / error states. Today-highlight. Responsive (month on
  desktop, list/day better on narrow). Keep prices out of any technician view.

---

## What we delete vs keep
- **Delete:** `WeekGrid.tsx`, `DayStrip.tsx`, `transform.ts` (grid math +
  weekStart/weekDays/toCalEvents), `HOUR_START/HOUR_END/HOUR_PX/TIME_COL/HOURS`
  from constants, `EVENT_COLOR` if unused.
- **Keep + rework:** `Planning.tsx` (page shell), `PlanningActions.tsx` (real
  view toggle + new-appointment), `DetailsPanel.tsx` (event details + actions),
  `api.ts` (+ schedule/unschedule/route calls), `constants.ts` (event colors,
  view keys).

---

## Order & verification
1. Backend DTO fix (curl: real address + name in feed).
2. FullCalendar mount + views + nav + theme (visual; tsc + build).
3. Schedule dialog + drag/resize/delete (curl each mutation).
4. Route overview list.
5. Roles + polish.

Verify with tsc + vite build + curl on every mutation (schedule → appears with
right address/technician → drag-reschedule → change duration → unschedule →
route list for the day). No browser tests. No auto-commit.

## Rules
English internals; NL/EN via i18n (incl. FullCalendar locale). Technician never
sees prices; client no access. Every mutation transactional + audit + (milestone)
activity. Enum values internal, labels translated.
