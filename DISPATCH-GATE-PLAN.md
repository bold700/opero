# Plan: technicians can see, but not work, an undispatched werkbon

Status: **implemented** (2026-08-07). Pinned by work-orders/dispatch-gate.test.ts.

## 1. The rule

A technician-level login may **view** any werkbon they're assigned to (unchanged
— planning transparency, evening-before prep, no field dead-ends), but may not
**write** to it until the office has dispatched it: no zone ticks, no hours or
notes, no photos, no material registration, no meerwerk, no attachments, no
sign-off. The werkbon says so plainly instead of showing disabled buttons.

Unaffected on purpose:
- **admin / office** — they own the gate; nothing changes.
- **foreman** (and projectleider logins, which are foreman-level) — they lead
  the work and today have blanket write via `canSeeAllProjects`; the gate does
  not apply to them.
- **client** — read-only today, read-only after.

This makes "Controle vooraf" a real control: the checklist gates dispatch, and
dispatch now gates field work. Completion stays gated only by its own
signature requirements — a dispatched job can always be closed out (see the
finish discussion; blocking sign-off retroactively punishes the monteur for
office prep).

## 2. Backend — one choke point

All werkbon mutations already funnel through `requireWritableWorkOrder` →
`loadProjectForWorkOrder` (`backend/src/modules/work-orders/routes.ts:153-198`),
which computes:

```ts
const canWrite =
  canSeeAllProjects(user.role) ||
  (user.role === "technician" && canViewWorkOrder(user, workOrder));
```

Change:
1. Add `dispatchedAt` to the loader's `select`.
2. Technician arm becomes
   `user.role === "technician" && canViewWorkOrder(...) && workOrder.dispatchedAt !== null`.
3. In `requireWritableWorkOrder`, when the ONLY reason for refusal is the
   dispatch gate, throw a distinct 403 message
   (`"Work order has not been dispatched yet"`) so the client can distinguish
   "not yours" from "not yet released" — and so test assertions are honest.

That single change covers every technician write: tasks, task materials,
photos, extra-work, attachments, **finish** — they all call the same guard.
No per-route edits. The prejob/dispatch routes themselves are office-only
already and unaffected.

Explicitly NOT doing: a data migration backfilling `dispatchedAt`. Greenfield;
existing undispatched werkbonnen simply lock for technicians until the office
presses "Monteur op pad sturen" once. Flagging this because it is visible
behavior change on existing data.

## 3. Client — state, not dead buttons

`client/src/features/work-order-detail/WorkOrderDetail.tsx:189` currently:
`const canWrite = isStaff(role)`.

1. `canWrite` becomes
   `isStaff(role) && (role !== "technician" || Boolean(wo.dispatchedAt))`
   (`dispatchedAt` is already in the DTO). Every panel already takes `canWrite`
   / `canWrite && !finished`, so zone ticks, photos, material add, meerwerk and
   attachments controls follow automatically — same pattern as `finished`.
2. `canFinish` gets the same technician condition, so the header button hides
   rather than 403s.
3. **Banner**: for a technician on an undispatched werkbon, an info Alert at the
   top of the detail: nl "Nog niet verzonden door kantoor — registreren kan
   zodra de werkbon is verzonden." / en "Not yet dispatched by the office — you
   can register work once it is." New i18n keys
   `workOrderDetail.notDispatched` (nl + en).
4. The technician's photos-only prejob card already shows the "Verzonden" chip;
   the banner covers the negative case, so dispatch state is now always legible
   to the monteur.

Optional (say if wanted, not included): a "wacht op verzending" chip on the
werkbon LIST rows for technicians.

## 4. Tests

Existing suites pin technician writes on never-dispatched fixtures, so they
will fail honestly. Update fixtures by stamping
`dispatchedAt: new Date()` on the werkbon in the setup of suites where
technicians write (at minimum: `attachments.test.ts`, `price-line.test.ts`,
`role-access.test.ts`, `meerwerk-totals.test.ts`, plus any zone/photo suite the
run flags).

New pins:
- technician PATCH task on undispatched werkbon → 403 with the dispatch message
- technician POST finish on undispatched werkbon → 403
- same calls after dispatch → 200
- foreman PATCH on undispatched werkbon → 200 (gate must not leak upward)
- client remains 403/404 either way

## 5. Order of work & verification

1. Backend loader + distinct 403 → `tsc`, fix fixture fallout, add new pins,
   full vitest green.
2. Client `canWrite`/`canFinish` + banner + i18n → `tsc`, i18n sweep,
   `vite build`.

Rollback: revert the loader condition and the client `canWrite` line; no schema
or data changes anywhere.
