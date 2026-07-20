# WOB Isolatie — client feedback (17-07-2026)

Source: `WOB Isolatie (1).pdf`, dated 17-07-2026. Each item below is checked against
the actual codebase as of this date, not taken at face value — see file:line
evidence per item.

## Already exists — no action needed

- **Reopen a closed werkbon** — `POST /work-orders/:id/reopen` (admin-only),
  button in `DetailHeader.tsx`.
- **Photo expand/lightbox on mobile** — `client/src/components/Lightbox.tsx` +
  `PhotoGrid.tsx`, viewport-relative sizing, already wired to task photos.
- **Technician sees own work orders only** — `canViewProject()`
  (`backend/src/modules/projects/visibility.ts`) scopes list + detail to
  assigned projects (teamLeader/projectLeader/installer). Admin sees all.
- **Technicians have their own login** — separate `User`/`Employee` models,
  invite-based provisioning (`backend/src/modules/users/routes.ts`).
- **Work order overview filters** — status chips (Alle/Open/Onderweg/Spoed/Klaar)
  + search by title/nummer/klant (`client/src/features/work-orders/`).

## Real gaps — new work

1. **KVK database check on customer creation** — doesn't exist anywhere.
   Needs an actual KVK API integration, not just a form field.
2. **Silvasoft/Excel import for customers** — doesn't exist. Only CSV *export*
   exists (Reports). Needs Silvasoft's export format before it's buildable.
3. **PDF/file upload on werkbons** — currently image-only (JPEG/PNG/WebP,
   re-encoded to JPEG) on task/prejob/meerwerk photo routes. `allowPdf` already
   exists as a flag in the upload layer (`backend/src/lib/upload.ts`), used
   today only by the separate "drawings" feature — extending it to the other
   photo routes is small and low-risk.
4. **Vacation/absence scheduling per employee** — only a static `on_leave`
   status toggle exists (`EmployeeStatus` enum), no dates. "Automatically not
   scheduled or invoiced" needs real date-range absence records that Planning
   and invoicing both read — a bigger feature (new model + Planning
   integration), not a toggle.
5. **Status doesn't reach "Completed" reliably** — confirmed bug:
   `deriveWorkOrderStatus()` (`backend/src/modules/work-orders/status.ts`)
   never reads `signedAt`. A signed werkbon with zero tasks (or all tasks
   later deleted) can stay "Open"/"Onderweg" forever and never surface under
   the Klaar filter. Worth fixing independent of the rest of this list.
6. **Materials edit affordance unclear** — partially addressed already
   (description is read-only by design now, quantity is click-to-edit), but
   there's no edit icon or visible hint that quantity is clickable. Small UI
   polish.
7. **Request intake automation** ("can this be partially automated") —
   open-ended, no concrete ask in the doc. Needs the client to say what
   "automated" means (auto-parse the email? auto-create a draft
   customer/project?) before it's buildable.

## Conflicts with decisions already made — need a client call, not a build

- **"Technicians should be able to add or edit materials"** (Technicians
  section) directly contradicts **"Technicians only register additional work,
  should not change the original work from quotation/work order"** (Features
  section) *and* contradicts the client's own direct instruction earlier this
  session ("technician shouldn't be able to add a task"). These can't all be
  true simultaneously. Best read: "add/edit materials" refers to **meerwerk**,
  not task lines — consistent with what's already built (technicians can
  report meerwerk; they cannot add/delete zones or task lines). Flagging so
  the wrong one doesn't get built.
- **"Custom/miscellaneous materials, user enters description/price/quantity
  themselves"** — this is the exact free-text-price hole already closed on
  task lines this session. It is confirmed still open on **meerwerk**:
  `addExtraWorkSchema` (`backend/src/modules/projects/schema.ts`) accepts a
  client-supplied `unitPrice` with zero server-side resolution, reachable by
  technicians via `POST /:id/extra-work`. Same bug, different door — this was
  mid-plan when deprioritized in favor of other fixes this session.
- **"Technicians should not be able to see prices"** — stated as absolute in
  the doc, but the code has an admin-facing toggle
  (`Organization.hidePricesFromTechnicians`, Settings → Preferences,
  `shared/src/permissions.ts` `canSeePrices()`) that can turn technician price
  visibility back on. If this is meant to be non-negotiable, the toggle
  itself should probably be removed, not just defaulted to hidden.

## Needs a decision, not a fix

- **"Technicians only register additional work"** — mostly true today, except
  a technician can still `PATCH` a zone's `description`/`workTypeId`/
  `assigneeId` directly via the API (`PATCH /work-orders/:id/tasks/:taskId`
  is gated only by `requireWritableWorkOrder`, not `requireRole("admin")`).
  The UI doesn't expose this as obviously off-limits either. Only worth
  tightening if zone title/work-type is confirmed to be office-only, the same
  as zone create/delete already is.

## Suggested priority

Given what's already been tightened this session (zone create/delete
admin-only, task-line free text removed, reopen added), the two gaps most
consistent with that direction:

1. **#5 — status/Klaar bug.** A signed werkbon silently not showing as done is
   a data-integrity issue, not a preference.
2. **Meerwerk free-text-price hole.** Same class of bug already fixed on task
   lines; leaving it open on meerwerk defeats the point of fixing task lines.

Everything else in this doc is new scope and should be scheduled separately
from bug fixes.
