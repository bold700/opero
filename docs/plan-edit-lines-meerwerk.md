# Plan: edit existing lines — task lines (taken) + meerwerk

## Requirements

1. A task line (taak) on a zone can be **edited in place**: change the article
   (re-pick from the catalog) and the quantity — instead of delete + re-add.
   Still catalog-only, no free text.
2. A meerwerk row can be **edited in place**:
   - catalog row → re-pick article + quantity (price re-resolves server-side);
   - free-text row → edit description/qty/unit; the **price only by admin**
     (this also closes the open gap: admin can now price a technician's
     free-text meerwerk after the fact).
3. Same price rules as create, everywhere: server resolves catalog prices;
   a technician's client-supplied price is discarded.

## Business rule (default, flagged)

Editing a meerwerk row **resets its approvals** (`approvedByOffice`,
`approvedByClient` → false): what was approved is no longer what the row says.
An activity entry records the edit. If the client wants approved rows to be
locked instead, that's a one-line change in the same route.

## Step 1 — Backend

**Task lines: nothing to add.** `PATCH /work-orders/:id/materials/:matId`
already re-resolves name/unit/price/cost/diameter when `variantId` is sent and
accepts `quantity`; it's covered by existing tests (variant-switch case in
`price-line.test.ts`).

**Meerwerk: new route `PATCH /work-orders/:id/extra-work/:mwId`**
(`work-orders/routes.ts`, after the from-catalog route). New zod schema
`updateExtraWorkSchema` in `projects/schema.ts`:

```ts
{ variantId?: string; quantity?: number; name?: string; unit?: string; unitPrice?: number }
```

Route logic (guard: `requireWritableWorkOrder`, load via `loadExtraWork`):
- `variantId` present → load variant (org-scoped, 404 otherwise), re-resolve
  name/unit/unitPrice/costPrice/diameter server-side, set `variantId`.
- `unitPrice` present → honored only when `user.role === "admin"` AND the row
  is free-text (`variantId` null after this patch); otherwise ignored.
- Recompute `amount = round(quantity × unitPrice)` and rebuild `description`.
- Any change → `approvedByOffice = false`, `approvedByClient = false`.
- Activity `extraWork.updated` + audit `workOrder.extraWork.update`.

**DTO prefill support** (`work-orders/dto.ts` + query include): the edit
dialog's cascade needs material + size to pre-select. Include
`variant: { select: { materialId: true, size: true } }` on both
`tasks.materials` and `extraWork`, expose `materialId` and `variantSize` on
`materialDto` and `extraWorkDto` (ids/size only — no price data).

## Step 2 — `AddTaskLineDialog` edit mode

Extend (no separate component — same picker, two modes):

- New props: `mode?: "add" | "edit"` and
  `initial?: { materialId: string; size: string; variantId: string; quantity: number }`.
- On open with `initial`, seed the material/size/variant/quantity state so the
  current article is pre-selected (fields remain changeable).
- Title/submit swap via i18n: `line.editTitle` ("Artikel wijzigen") /
  `line.editSubmit` ("Opslaan"); add mode keeps existing keys.

## Step 3 — Task-line edit UI

- `TaskLineRow.tsx`: add an edit (pencil) `IconButton` next to delete,
  `canWrite`-gated, `aria-label` = `common.actions.edit`. Emits `onEdit()`.
- `ZoneCard.tsx`: hold `editing: WorkOrderMaterial | null`; render one
  `AddTaskLineDialog` in edit mode with `initial` built from the row
  (`materialId`/`variantSize`/`variantId`/`quantity`); submit → new
  `onEditLine(matId, { variantId, quantity })` prop.
- `TasksPanel.tsx` → `WorkOrderDetail.tsx`: thread `onEditLine` →
  `updateMaterial(wo.id, matId, { variantId, quantity })` + refresh.
- Rows without `variantId` (legacy free-text rows): no edit button — nothing
  valid to re-pick; delete + re-add stays their path.

## Step 4 — Meerwerk edit UI

- `api.ts`: `updateExtraWork(workOrderId, mwId, patch)` → the new PATCH.
- `ExtraWorkPanel.tsx`: edit icon per row, `canReport`-gated (hidden on
  rejected rows):
  - row has `variantId` → open `AddTaskLineDialog` edit mode (prefilled) →
    PATCH `{ variantId, quantity }`;
  - free-text row → reuse `ReportForm` inline, prefilled with the row's
    name/qty/unit (+ current price for admin), submit → PATCH
    `{ name, quantity, unit, unitPrice? }`. `ReportForm` gets optional
    `initial` + submit-label override; price field stays `canSetPrice`
    (admin) — this is where admin prices a tech's free-text row.
- `WorkOrderDetail.tsx`: thread the handler with `run()` + refresh.

## Step 5 — i18n (nl/en `workOrderDetail.json`)

- `line.editTitle`: "Artikel wijzigen" / "Change article"
- `line.editSubmit`: "Opslaan" / "Save"
- `extraWork.edit` (aria/tooltip): "Bewerken" / "Edit"
- Activity key `activity.extraWork.updated`: "Meerwerk bijgewerkt: {{description}}"
  / "Extra work updated: {{description}}" (nl/en `activity.json`).

## Step 6 — Tests + verification

Extend `extra-work-pricing.test.ts`:
- tech PATCH free-text row with `unitPrice: 999` → still 0.
- admin PATCH free-text row with `unitPrice: 50` → stored, amount recomputed.
- PATCH `variantId` → name/price/cost re-resolved from the new variant.
- an approved row, after PATCH → both approval flags false.

Then: backend + client + shared `tsc --noEmit`, full
`vitest run src/modules/work-orders/`, `vite build`.

## Order of work

1. Backend schema + PATCH route + DTO prefill fields + tests green.
2. `AddTaskLineDialog` edit mode + i18n.
3. Task-line edit UI thread-through.
4. Meerwerk edit UI thread-through.
5. Full typecheck/build/suite.
