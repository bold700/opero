# Plan: hours logging + the 3-way price rule on the werkbon

Two items from Kevin/Kenny (2026-07-20).

## Requirement A — the price rule (Kenny, 11:18)

Three views of the same task line:

| Role | Sees |
|---|---|
| **admin / office** | product + details + **price** + **margin** |
| **technician** | product + details + what to do — **no price** |
| **client** | product + details + meters/qty + **price** (no margin) |

**This contradicts a change made earlier in this session.** "On the werkbon there
should be no prices" was implemented literally: prices were stripped from the
task table for *everyone* (`TasksPanel` is currently passed `showPrices={false}`,
`showMargin={false}`, and `TaskLineRow`/`ZoneCard` have no price rendering left).
Kenny has now clarified he meant *no prices **for technicians***, not for
everyone. So that change must be reverted, not extended.

Note the codebase already implements exactly this 3-way rule everywhere else —
`canSeePrices()` / `canSeeMargin()` in `shared/src/permissions.ts`, and the
Meerwerk panel still uses it correctly. Only the task table diverged.

### Step A1 — restore price rendering on the task line

`client/src/features/work-order-detail/`:

- `WorkOrderDetail.tsx`: pass the real flags to `TasksPanel` again —
  `showPrices={showPrices}` / `showMargin={showMargin}` (both already computed
  for `ExtraWorkPanel` on the same screen).
- `TasksPanel.tsx` → `ZoneCard.tsx` → `TaskLineRow.tsx`: re-thread the two props
  and restore the price cell:
  - `showPrices` → line total (`quantity × unitPrice`).
  - `showMargin` → the admin-only margin annotation beneath it.
  - `ZoneCard` also regains its per-zone total (same two gates).
- Restore the `euro()` import in both files.

Reference: git history for these files before the "remove prices" change, and
`ExtraWorkPanel.tsx`, which still shows the intended pattern.

### Step A2 — decide the technician toggle (needs a client answer)

`canSeePrices(role, hidePricesFromTechnicians)` hides prices from technicians
only when the org flag is on. It **defaults to true**, but an admin can switch it
off in Settings → Preferences, which would show technicians prices — contradicting
Kenny's rule. Options:

1. Leave it (default already hides; admin can override if they ever want to).
2. Remove the toggle so "technicians never see prices" is absolute.

Recommend **1** unless Kenny says the rule is non-negotiable; it's a one-line
change either way. No code change in this plan until answered.

### Step A3 — verify

Backend already strips prices per role in the DTO (`materialDto`), so this is
presentation-only; no API change. Add a client-side check by logging in as each
role, or extend the existing DTO tests (`price-line.test.ts` already covers the
3-way rule at the API layer).

## Requirement B — technicians log hours (Kevin, 11:12)

"This works but it's missing the feature where technicians can log hours."

**The backend is already complete** — nothing to build there:

- `POST /work-orders/:id/tasks/:taskId/start` — sets `startedAt`.
- `POST /work-orders/:id/tasks/:taskId/end` — sets `endedAt`, computes `hours`
  from the elapsed time (rounded to 0.25), marks the task done.
- `PATCH /work-orders/:id/tasks/:taskId/hours { hours }` — manual override.
- All three are gated by `requireWritableWorkOrder`, so an assigned technician
  may call them. `WorkOrderTask.hours` is a real column.

**The client never calls any of them.** `hours` appears once in
`work-order-detail/api.ts` as a type field and nowhere else. That is the entire
gap — and it is why Reports shows 0 hours and why the Timesheet screen (which is
read-only) is always empty.

### Step B1 — client API

`work-order-detail/api.ts`:

```ts
export function startTask(workOrderId, taskId): Promise<WorkOrder>
export function endTask(workOrderId, taskId): Promise<WorkOrder>
export function setTaskHours(workOrderId, taskId, hours: number): Promise<WorkOrder>
```

Add `startedAt`/`endedAt` to the `WorkOrderTask` client type (confirm they are
already exposed by `taskDto` — `routes.ts:414` returns `hours`, so check the
neighbouring fields).

### Step B2 — zone UI

In `ZoneCard.tsx`, in the zone header next to the status badge:

- Not started → **Start** button (`startTask`).
- Running → a live "since HH:MM" label + **Stop** button (`endTask`).
- Finished → the logged hours as text, click-to-edit for a manual override
  (`setTaskHours`) — same inline-edit pattern already used for task-line
  quantity in `TaskLineRow`.

Gate on `canWrite` (admin + assigned technician), hidden when the werkbon is
signed off (`finished`), consistent with the rest of the card.

Hours are **not** a price — they stay visible to technicians in every case.

### Step B3 — thread through

`ZoneCard` → `TasksPanel` → `WorkOrderDetail`, wired with `run()` +
`refreshWorkOrder()` exactly like the existing line handlers.

### Step B4 — i18n

`nl/en workOrderDetail.json` under `zone`: `start`, `stop`, `hours`,
`hoursLabel`. Activity keys `task.completedViaTimer` / `task.hoursChanged`
already exist server-side — check `activity.json` has both, add if missing.

### Step B5 — tests + verification

- Backend: routes exist and are presumably covered; add a role test that an
  assigned technician may start/end/override hours and a non-assigned one gets
  404/403 if not already present.
- Then: `tsc --noEmit` (client + backend), `vitest run` (backend),
  `vite build`.

## Knock-on effect

Once B ships, **Reports stops showing 0 hours** and the Timesheet screen fills
in — both read `WorkOrderTask.hours`, which nothing currently writes. Revenue
and material costs stay €0 until an invoicing UI exists (separate gap: the
invoice API exists, `POST .../invoice/draft|send|paid`, but there is no
invoices screen in the client at all).

## Order of work

1. A1 — restore the 3-way prices on the task line (small, unblocks a
   miscommunication already shipped to the client).
2. B1–B4 — hours logging.
3. B5 — tests, typecheck, build.
4. A2 — only after Kenny answers on the toggle.
