# Plan: urgency redesign — three phases, end to end

Status: **implemented end to end** (2026-08-07). All three phases shipped;
migration `20260807170000_urgency_per_werkbon`; suite 37 files / 331 tests
green; dev DB reseeded and verified consistent.

## Phase 1 — tests stop trampling the dev database

Five suites grab a SEEDED project via `findFirst` and mutate it (this is what
left all 12 demo projects urgent):
- `projects/project-sidebar.test.ts:49` (also PATCHes urgency onto it)
- `work-orders/price-line.test.ts:88`
- `materials/material-crud.test.ts:173`
- `work-orders/photos.test.ts:51`
- `work-orders/meerwerk-totals.test.ts:76`

Each gets its own TAG'd customer + project created via the API (the pattern 30
other suites already use) and cleaned up in afterAll. No shared fixture is
touched again.

## Phase 2 — `blocked` stops being an urgency value

Blocked is workflow state ("cannot proceed"), not priority. It already has its
own columns (`Project.blocker` / `blockerKey`); the enum value was a duplicate
representation that leaked "Spoed" onto werkbonnen of stalled jobs.

- Enum shrinks to `normal | urgent`.
- Blocked-ness = `blocker != null || blockerKey != null`, exposed as
  `blocked: boolean` on project DTOs.
- The blocked flows (material availability, intake, resolve-blocker) stop
  writing urgency at all — they already maintain the blocker columns.
- Migration preserves manually-blocked projects (urgency was 'blocked' with no
  blocker recorded — possible via the old sidebar): they get
  `blockerKey = 'manuallyBlocked'` so no blocked state is silently lost.
- Werkbon header shows a "Geblokkeerd" chip from `project.blocked` (label
  reuses the existing i18n key). Status derivation no longer maps blocked →
  "urgent", so stalled jobs stop telling monteurs to hurry.

## Phase 3 — urgency moves to the werkbon (the unit of work)

The werkbon owns scheduling and billing; "this visit is urgent" was
inexpressible because urgency sat on the project and stamped every sibling.

- `WorkOrder.urgency: normal | urgent` (default normal). Migration backfills
  from the parent project's value, then DROPS `Project.urgency`.
- `listStatus` derives from the werkbon's OWN urgency (urgent wins over
  progress, sign-off still wins over everything) — recomputed via the existing
  `reloadWorkOrder` path on every werkbon PATCH, so no new sync machinery.
- The sidebar urgency select now edits THIS werkbon (office-only via the
  existing PATCH gate; technicians already can't PATCH).
- Project-level consumers re-pointed to derivations:
  - projects list/detail DTO `urgency` := 'urgent' if any unsigned werkbon is
    urgent, else 'normal' (field kept for API shape; no client UI renders it).
  - dashboard "urgent" KPI := projects with an unsigned urgent werkbon;
    "blocked" KPI := projects with blocker state.
  - notifications "urgent/blocked projects" := blocker state OR unsigned
    urgent werkbon.
- Deleted as obsolete: `applyProjectUrgency`, `POST /projects/:id/urgency`
  (no client caller exists), `urgency` in the project PATCH schema and the
  client `ProjectSidebarPatch`. The urgency-sync tests from earlier today are
  REWRITTEN for werkbon-level semantics (this supersedes that fix — the whole
  project→werkbon sync problem ceases to exist because the input and the
  derived column now live on the same row).
- Seed: projects stop getting urgency; each seeded werkbon inherits
  urgent/normal from its mock project (mock 'blocked' → normal + the blocker
  text mock already carries).
- Post-migration: run `backfillAllWorkOrderStatuses()` so werkbonnen of
  formerly-blocked projects drop their misleading "urgent" status.

## Invariants after all three phases
- Marking one visit urgent no longer touches its siblings.
- A blocked project's werkbonnen show progress status + a blocked chip, never
  a false "Spoed".
- No test writes to seeded data.
- One urgency field, on the row whose status derives from it — the
  denormalization can no longer desync across tables.

## Verification
Full backend suite green, backend+client tsc, vite build, i18n sweep, and DB
spot-checks (enum values, no project.urgency column, werkbon urgency counts,
zero derivation violations).
