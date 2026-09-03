# Plan: one write path for project urgency (listStatus can't go stale)

Status: **implemented** (2026-08-07). Pinned by projects/urgency-sync.test.ts; dev DB backfilled.

## 1. Root cause, precisely

`WorkOrder.listStatus` is a derived, persisted column. Its inputs are the
werkbon's own `signedAt` + task progress, and — the cross-module one —
`project.urgency`. The invariant is "after any write to an input, resync".

Audit of every `project.urgency` writer:

| Writer | Resyncs werkbonnen? |
|---|---|
| `POST /projects/:id/urgency` (projects screen) | ✅ `recomputeWorkOrdersForProject` in tx |
| material-availability flow (`urgency: "blocked"`) | ✅ same |
| intake-complete flow (`urgency: blocker ? "blocked" : …`) | ✅ same |
| project create (`urgency: "normal"`, no werkbonnen yet) | n/a |
| **`PATCH /projects/:id` (generic patch — what the werkbon sidebar calls)** | ❌ **writes the column, never resyncs** |

So four of five writers follow the convention and one forgot. Every werkbon
mutation *response* recomputes its own row (`reloadWorkOrder`), which is why a
werkbon you've edited shows "Urgent" while its untouched siblings and the list
show stale "Open".

The hack would be adding the missing call to the PATCH handler. That leaves the
convention exactly as forgettable as it was — the sixth writer someone adds
next year forgets it again.

## 2. The proper fix: make the convention structural

### 2a. A single urgency writer (same idiom as planning/schedule.ts)

New function in `backend/src/modules/projects/` (or alongside
`work-orders/status.ts`):

```ts
// THE single write path for project.urgency. Writing the column anywhere else
// is a bug: listStatus derives from it, and the two must commit together.
export async function applyProjectUrgency(
  tx: Tx, user: AuthUser, project: { id: string; urgency: string },
  urgency: Urgency,
): Promise<void>
```

Behavior: no-op when unchanged; otherwise write + `recomputeWorkOrdersForProject`
+ the `project.urgencyChanged` activity + audit — so BOTH entry points get
identical side effects (today only the dedicated endpoint logs the activity;
the PATCH path changes urgency silently, which is a second, quieter bug).

Callers converted:
- `POST /projects/:id/urgency` → thin wrapper around the service.
- `PATCH /projects/:id` → when `input.urgency` present, delegate to the service
  inside its existing transaction; remove the bare `data.urgency = …` line.
- The blocked-flows keep their own resync call (they write urgency as part of
  larger composite writes and already hold the convention), but get a comment
  pointing at the service as the reason the resync must stay.

### 2b. Grep-guard the invariant

`data.urgency` / `urgency:` writes on the project model outside the service are
now findable: add one comment block on the Prisma `urgency` field
(schema.prisma) naming `applyProjectUrgency` as the only legal writer — the
same documentation pattern the schema already uses for `TeamRole` ("a TeamRole
in an access check is a bug").

### 2c. Heal existing stale rows (data, not code)

Databases that took urgency changes through the PATCH already hold stale
`listStatus`. `backfillAllWorkOrderStatuses()` exists for exactly this (built
for the original listStatus migration). Re-run it once via a tsx one-liner
after deploy (`corepack pnpm exec tsx -e "…backfillAllWorkOrderStatuses()"`)
— documented in the plan, not a schema migration, since the derivation lives in
TS and SQL-reimplementing it would be a second source of truth.

## 3. Explicitly rejected

- **DB trigger** — derivation logic would exist twice (TS + SQL); not the
  stack's idiom, nothing else uses triggers.
- **Compute status on read** — the list filters/counts/paginates on the indexed
  column; recomputing per-read means joining every task of every row on every
  list load. The denormalization is the right call; only the sync discipline
  was missing.
- **Client-side switch to the dedicated endpoint** — fixes this caller, leaves
  the API able to desync (any future PATCH caller re-breaks it). The invariant
  belongs to the write path, not to callers' good manners.

## 4. Tests

- `PATCH /projects/:id {urgency:"urgent"}` → ALL the project's werkbonnen
  report `status:"urgent"` in the list DTO (the exact reported bug).
- Same via `POST /:id/urgency` (pin both entry points against drift).
- Urgency back to `normal` → statuses fall back to task-derived values
  (open / on_the_way), not stuck on "urgent".
- Unchanged-urgency PATCH → no `project.urgencyChanged` activity row (no-op
  guard works).
- Signed werkbon stays "done" through an urgency flip (sign-off outranks).

## 5. Order of work & verification

1. Service + convert the two endpoints + schema comment.
2. New tests; full backend suite (currently 36 files / 326 green).
3. `tsc` both, `vite build` (client untouched except nothing — no client change
   needed).
4. Run the backfill once against the dev DB; spot-check with the SQL from this
   session (`SELECT listStatus, count(*) …`).
