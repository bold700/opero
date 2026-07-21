# Plan: per-werkbon pre-job checklist (template + override)

**Decision (client):** the pre-job checklist is a **template in Settings** that
each werkbon **copies on creation** and can then **edit on the werkbon itself**
(add / rename / remove items for that job only). Editing one werkbon must not
touch the template or any other werkbon; editing the template must not
retroactively change existing werkbonnen.

This builds ON the org-template feature already shipped (`PrejobCheckItem` +
Settings CRUD). That stays — it becomes the **template layer**. This plan adds
the **per-werkbon instance layer**.

## The core model shift

Today: the werkbon stores only `prejobCheck` (a JSON map key→done); the ITEMS
(labels) are derived from the org's live template on every read
(`getPrejobItems(orgId)` in the DTO / gate / PDF).

That derivation is exactly what makes it org-wide and NOT per-werkbon. For a true
per-werkbon checklist, the werkbon must **carry its own items** — snapshotted
from the template when the werkbon is created — so:
- editing the template later doesn't mutate old werkbonnen,
- editing a werkbon's checklist doesn't touch the template,
- a werkbon's PDF/history always reflects the checklist as it was on that job.

### New per-werkbon storage

A row per item per werkbon (parallels how `PrejobCheckItem` is a row per item
per org):

```prisma
model WorkOrderPrejobItem {
  id          String   @id @default(uuid())
  workOrderId String
  key         String   // stable within the werkbon; copied from template or generated for a one-off
  label       String
  done        Boolean  @default(false)
  ordinal     Int      @default(0)

  workOrder WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)

  @@unique([workOrderId, key])
  @@index([workOrderId])
}
```

- Replaces the JSON `WorkOrder.prejobCheck` map as the source of truth. Keep the
  old `prejobCheck` column for one release for safety, but stop writing/reading
  it once migrated (or drop it in the same migration after backfill — see Step
  6).
- `done` lives ON the item row now, not a separate map — simpler and it can't
  drift from the item set.

## Step 1 — Data model + migration

- Add `WorkOrderPrejobItem` + the `WorkOrder` back-relation.
- **Data migration (critical):** for every existing werkbon, create its item
  rows from the ORG's current template items, carrying over any `done=true`
  already recorded in that werkbon's `prejobCheck` JSON (match by key). Werkbonnen
  with no template items get none. Idempotent.

## Step 2 — Werkbon creation snapshots the template

`POST /work-orders` (`routes.ts:593`): inside the create transaction, read the
org's active template items (`getPrejobItems(orgId)`) and create a
`WorkOrderPrejobItem` per item (key/label/ordinal copied, `done=false`). From
here the werkbon owns its checklist.

## Step 3 — Per-werkbon checklist CRUD (on the werkbon)

New routes, `requireWritableWorkOrder` (admin + assigned technician — same as the
rest of the werkbon; or admin-only if the client wants office-only control —
FLAG). All operate on `WorkOrderPrejobItem` scoped to `:id`:

- `POST /work-orders/:id/prejob-items { label }` — add a one-off item to THIS
  werkbon (generate a unique key within the werkbon, append ordinal).
- `PATCH /work-orders/:id/prejob-items/:itemId { label?, done? }` — rename or
  tick/untick. (This replaces the current `PATCH /:id/prejob-check {key,done}`
  toggle — repoint the client to the new route, or keep the old path as an alias
  that resolves key→row.)
- `POST /work-orders/:id/prejob-items/reorder { orderedIds }`.
- `DELETE /work-orders/:id/prejob-items/:itemId` — hard delete is fine HERE (it's
  this werkbon's own instance, pre-dispatch; no cross-werkbon history to protect,
  unlike the template's soft-delete). Block edits once `dispatchedAt` is set,
  same as the current toggle guard.

## Step 4 — Rewire the gate / DTO / PDF to the werkbon's items

Everything currently calling `getPrejobItems(orgId)` for a specific werkbon
switches to that werkbon's own `WorkOrderPrejobItem` rows:

- `dto.ts` (`workOrderDto`): emit `prejobItems: {key,label,done,ordinal}[]` from
  the werkbon rows; compute `prejobComplete`/`canDispatch` from them. Drop the
  `prejobItems` param that currently threads the org template in.
- Dispatch route (`routes.ts` dispatch): `canDispatch` uses the werkbon's items.
- PDF (`routes.ts` pdf builder + `pdf.ts`): labels come from the werkbon's own
  rows — no org lookup, no `prejobLabels` map needed; each row already has its
  label. Simplifies what was just added.
- `shared/src/prejob.ts`: `isPrejobChecklistComplete` / `canDispatch` already
  take an item-key list — keep that signature; callers pass the werkbon's keys.
  `normalizePrejobCheck` is no longer needed once `done` lives on rows — remove
  or repurpose.

## Step 5 — Client

- **Werkbon `PreJobPanel`**: the checklist becomes EDITABLE inline (for
  canWrite, pre-dispatch): rename items, tick them (already), add a one-off item,
  remove one, reorder. Mirror the Settings `PrejobChecklistForm` UX but bound to
  the werkbon's routes. Reads `workOrder.prejobItems` (now with `done`).
- `api.ts`: werkbon type `prejobItems: {key,label,done,ordinal}[]`; new per-werkbon
  item calls; repoint the toggle.
- **Settings `PrejobChecklistForm` stays** — it's the template now. Add a one-line
  note in its copy: "New work orders start from this list; each work order can be
  adjusted on its own." (i18n update.)

## Step 6 — Retire the old JSON map

After the backfill (Step 1) proves out: stop reading/writing
`WorkOrder.prejobCheck`; drop the column in a follow-up migration (or same one if
confident). Keep `prejobPhotos` untouched — the photo half of the gate is a
SEPARATE concern (the earlier "do we even need a photo" thread is not part of
this change).

## Step 7 — Tests + verification

- Werkbon creation snapshots the template (N template items → N werkbon items,
  done=false).
- Editing the template afterwards does NOT change an existing werkbon's items.
- Per-werkbon add/rename/remove/reorder; tick → `prejobComplete` flips; complete
  + photo → dispatch allowed; incomplete → 404/400.
- A werkbon with a since-removed template item still serializes + PDFs (its own
  row carries the label).
- `tsc` shared→backend→client, full backend `vitest run`, `vite build`.

## Decisions (confirmed)

1. **Who edits the werkbon checklist: ADMIN ONLY.** Verified in code — `POST
   /work-orders` is `requireRole("admin")`; technicians never create werkbonnen,
   they're assigned and fill in tasks/photos/signature. The pre-job checklist is
   office prep before dispatch, so all per-werkbon checklist CRUD routes (Step 3)
   are `requireRole("admin")`, NOT `requireWritableWorkOrder`. Ticking items also
   becomes admin-only (it's pre-dispatch office work).
2. **Empty werkbon checklist blocks dispatch** — same fail-safe as the template.
3. **Photo requirement: a PER-WERKBON toggle, default OFF.** New nullable
   `WorkOrder.prejobPhotoRequired` (admin sets it on the werkbon's pre-job panel).
   `canDispatch` gains a `requirePhoto` arg: when false, photos are ignored
   entirely; when true, at least one pre-job photo is required (today's
   behaviour). Default off — a job only requires a photo if the admin says so.
   - `shared/src/prejob.ts` `canDispatch(check, photoCount, itemKeys, requirePhoto)`
     → `isComplete(...) && (!requirePhoto || photoCount > 0)`.
   - `PATCH /work-orders/:id` (admin) accepts `prejobPhotoRequired`.
   - DTO emits `prejobPhotoRequired` so the panel shows the toggle + gates the UI.

## Order of work

1. Confirm decisions 1–2.
2. Model + backfill migration.
3. Creation-snapshot + per-werkbon CRUD + gate/DTO/PDF rewire + tests.
4. Werkbon PreJobPanel editing UI + api + i18n.
5. Retire the JSON map.
6. Full typecheck / suite / build.
