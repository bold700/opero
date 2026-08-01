# Werkbon ↔ Planning Sync — Plan

**Status:** proposed (not implemented)
**Issue:** client item 2 — "The calendar selection used to work. Now I can only enter a date manually."
**Severity:** the two schedule views can silently contradict each other.

---

## 1. Problem

A werkbon's schedule lives in **two** places:

| Store | Written by | Read by |
|---|---|---|
| `WorkOrder.plannedDate` / `plannedEndDate` | werkbon detail (PATCH `/work-orders/:id`) **and** planning | werkbon detail, work-order list filters, dashboards |
| `PlanningItem` (date, start/end time, crew, vehicle) | **planning only** (`POST /planning/work-orders/:id/planning`) | the planning calendar (preferred over `plannedDate`) |

The planning route writes **both** in one transaction (`planning/routes.ts` ~line 284–331).
The werkbon PATCH writes **only** `plannedDate`/`plannedEndDate` — `planningItem` appears **zero times** in `work-orders/routes.ts`.

### Reproduced live

Werkbon `89b9030d…` (seed) had a PlanningItem on `2026-05-03`. Setting its date to
`2026-10-14` through the werkbon date field produced:

```
WorkOrder.plannedDate  = 2026-10-14   ← werkbon detail shows 14 Oct
PlanningItem.date      = 2026-05-03   ← calendar still draws it on 3 May
```

`GET /planning?from=2026-10-01&to=2026-11-01` → 0 entries for that werkbon.
`GET /planning?from=2026-05-01&to=2026-05-31` → 1 entry, dated `2026-05-03`.

(Data was restored afterwards; the seed is consistent again.)

### Exact failure conditions

`planningEntriesForWorkOrder` (`planning/dto.ts`) prefers PlanningItems and only
falls back to `plannedDate` when **no** items exist. Therefore:

- **Werkbon never scheduled via Planning** (no PlanningItem): the date-only
  fallback renders it on the calendar. Works, but the entry has no times, crew
  or vehicle.
- **Werkbon that has ever been scheduled via Planning** (has a PlanningItem):
  changing the date from the werkbon screen updates `plannedDate` only. The
  stale PlanningItem **shadows** it — the calendar shows the old date, the
  werkbon shows the new one. This is the reported symptom: edits from the
  werkbon side look like they simply don't take.

Everything office-scheduled goes through Planning, so the shadowing case is the
common one, not the edge case.

---

## 2. Goal

**One write path for "when is this werkbon".** Whichever screen sets the date,
both stores update atomically, so the calendar and the werkbon can never
disagree.

Non-goals: redesigning the PlanningItem model, multi-slot-per-werkbon
scheduling UI, drag-to-schedule changes. The calendar UI itself is untouched.

---

## 3. Design

### 3.1 Extract a shared scheduling service

New module: `backend/src/modules/planning/schedule.ts`

```
applyWorkOrderSchedule(tx, user, workOrder, {
  date,                 // "YYYY-MM-DD" — the (new) start date
  endDate?,             // optional, multi-day
  startTime?, endTime?, // optional; defaults 08:00 / 15:30 on create
  teamLeaderId?, vehicle?,
})
clearWorkOrderSchedule(tx, user, workOrder)
```

Behaviour (moved verbatim from the current `POST /planning/work-orders/:id/planning`
handler — this is a refactor, not a rewrite):

- **Upsert the slot:** update the first PlanningItem in place, or create one
  with the store defaults (08:00–15:30, crew copied from werkbon assignees,
  vehicle "Bus - nog toewijzen", project leader from the project).
- **Update the werkbon:** `plannedDate` / `plannedEndDate` in the same
  transaction.
- **Append the `scheduled` project activity** with the same messageKey the
  planning route uses today, so both entry points produce identical audit
  trails.
- `clearWorkOrderSchedule` mirrors the existing DELETE route: null both werkbon
  fields, delete all PlanningItems, log activity.

The existing planning routes (`POST`, `DELETE`, the duration endpoint) become
thin wrappers around these functions. Their request/response contracts do not
change — the frontend planning code needs no edits.

### 3.2 Route the werkbon PATCH through it

In `work-orders/routes.ts` PATCH `/:id`:

- If the input contains `plannedDate`/`plannedEndDate`, do **not** write those
  columns directly. Instead:
  - `plannedDate: null` → `clearWorkOrderSchedule` (also removes the slot —
    today clearing the field leaves an orphaned PlanningItem that resurrects
    the werkbon on the calendar).
  - `plannedDate: "YYYY-MM-DD"` → `applyWorkOrderSchedule` with the date
    (+ `endDate` when `plannedEndDate` is in the same patch). Times/crew/vehicle
    are not passed — an existing slot keeps its times and crew, only its date
    moves; a new slot gets the defaults.
  - `plannedEndDate` alone (start unchanged) → update `plannedEndDate` on the
    werkbon only. The single slot stays on the start date (see 3.3).
- All other PATCH fields are handled exactly as today, inside the same
  transaction.
- Permissions are unchanged: the schedule fields already sit behind the
  office-only scope gate, and the sync inherits that automatically.

### 3.3 Multi-day semantics — decision required

A werkbon can span `plannedDate…plannedEndDate`, but a PlanningItem is a single
date. Options:

- **A. One slot on the start date (recommended).** The calendar entry already
  carries `plannedEndDate` (`planning/dto.ts` line 77 includes it on
  item-backed entries), so the range is available to the renderer. This is what
  the planning route does today — no model change, no explosion of rows.
- **B. One slot per day.** Truthful per-day crew/vehicle, but: N rows to keep
  in sync on every edit, ambiguous semantics when days differ, and the current
  UI has no way to edit per-day slots. Significantly more surface for the same
  user-visible outcome.

Plan assumes **A** unless you say otherwise. B can be layered on later without
undoing A.

### 3.4 Reconciliation of existing drifted data

Any production rows where a PlanningItem exists but no item matches
`plannedDate` are already silently wrong today. One-off script (run manually,
report before write):

1. **Report:** list werkbonnen where `planningItems.length > 0` and no item's
   `date` equals `plannedDate`.
2. **Fix:** move the first PlanningItem's `date` to `plannedDate`.

Direction rationale: drift can only be produced by the werkbon-PATCH path (the
planning path writes both), so in every drifted row `plannedDate` is the newer
intent. Not a Prisma migration — data repair, not schema.

---

## 4. Implementation steps

1. **`schedule.ts`:** extract `applyWorkOrderSchedule` / `clearWorkOrderSchedule`
   from the planning route handlers. Pure refactor; planning tests must stay
   green untouched.
2. **Rewire planning routes** (`POST`, `DELETE`, duration) onto the service.
3. **Rewire werkbon PATCH** schedule fields onto the service (per 3.2).
4. **Tests** — new `backend/src/modules/planning/schedule-sync.test.ts`:
   - PATCH date on a werkbon **with** a PlanningItem → item moves; calendar
     feed shows the new date, not the old.
   - PATCH date on a werkbon **without** items → item created with defaults;
     feed entry now has times.
   - PATCH `plannedDate: null` → items deleted, werkbon off the calendar.
   - PATCH `plannedEndDate` only → range updated, slot stays on start date.
   - Schedule via planning route → werkbon detail reflects the date (guards the
     existing direction).
   - Existing slot keeps its times/crew/vehicle when only the date moves.
   - Activity row appended for both entry points.
   - Technician/foreman PATCH of schedule fields still 403s.
5. **Reconciliation script** (`backend/scripts/` or a tsx one-off): report +
   fix as in 3.4.
6. **Frontend:** no changes required — `setWorkOrderSchedule` already PATCHes
   and re-renders from the response; the calendar refetches per view window.
   Optional nicety (separate ticket): a hint on the werkbon date field that
   times/crew are edited on the Planning screen.

Estimated scope: ~1 service file, 2 route files touched, 1 test file, 1 script.
No schema changes. No client changes.

---

## 5. Verification

- Full backend suite (currently 252 passing) + the new sync tests.
- Live curl pass mirroring the repro in §1: set date via werkbon PATCH, read
  `/planning` feed for old + new windows; then the reverse via the planning
  route; then clearing.
- `tsc --noEmit` both workspaces (client untouched but cheap to confirm).

## 6. Risks

- **Behavior change on clearing:** today, clearing the werkbon date leaves the
  slot (calendar keeps the werkbon); after the fix it removes it. This is the
  intended semantic ("no date = not planned") but is a visible change — worth a
  line in release notes.
- **PATCH becomes heavier** for schedule edits (extra reads + item upsert in
  the transaction). Negligible at this scale.
- **Multiple PlanningItems:** the model allows several; both the current
  planning route and this plan operate on the *first*. Extra items are legacy
  data — the reconciliation report will surface any so they can be reviewed
  rather than silently kept.

## 7. Related but out of scope

- **Language/locale observation:** the reporter's screenshot showed the English
  UI (`mm/dd/yyyy`, "Start date"), meaning their session ran in English —
  native date inputs follow locale. If that user should be seeing Dutch, check
  their stored preference (`user.preferences.language`) — separate issue.
- **Foreman scheduling rights:** foreman currently cannot schedule (backend
  403). If the reporter is a foreman, that's a permissions decision, not a sync
  bug — tracked under client item 2 discussion.
