# Plan: werkbon header shows its OWN status, plus a "not dispatched" marker

Status: **implemented** (2026-08-07).

## 1. Problems this fixes

1. The werkbon detail header badge renders `project.stage` — the PARENT's stage
   — unlabeled, next to the werkbon title. A fresh, untouched werkbon shows
   "Done" because its demo project sits in stage done. The werkbon's own
   derived status (`listStatus`: open / on the way / urgent / done) is what the
   list shows, but the detail never uses it.
2. Dispatch state now gates technician work but is invisible except as a banner
   on the detail page. The office cannot scan "which scheduled werkbonnen have
   we not released yet?" anywhere.

Explicit non-goal: dispatch does NOT become a fifth `listStatus` value. Status
measures progress; dispatch measures release. Independent axes ("zones ticked
by office, not yet dispatched" is a real combination), so it's a separate
marker, not an enum member.

## 2. Changes

### Backend (2 small DTO additions, no schema/migrations)
- Detail DTO (`work-orders/dto.ts`): add `status: wb.listStatus` — the field is
  already persisted and recomputed at every mutation boundary; the detail just
  never carried it.
- List row DTO: add `dispatchedAt` (already on the model; the list DTO omits
  it).

### Client — detail header (`DetailHeader.tsx`)
- The unlabeled `project.stage` badge is REPLACED by the werkbon's own status
  badge, using the same `STATUS` label/tone map the list already uses (reuse,
  not a second map).
- Next to it, when `!wo.dispatchedAt && !finished` and the viewer is staff: a
  small warning-tone chip "Niet verzonden" / "Not dispatched". Disappears on
  dispatch — released is the normal state and gets no badge.
- The urgency badge stays as is.
- Project stage stops appearing in the header. If it should stay visible at
  all, it goes into the Details sidebar as a LABELED row ("Projectfase") —
  optional, say if wanted; default is to drop it from this page entirely, since
  it belongs to the project screen.

### Client — work-orders list (`WorkOrdersTable.tsx`)
- In the status cell (table and mobile card): the same "Niet verzonden" chip
  next to the status badge when the row is undispatched. Staff only — clients
  see their werkbonnen in this list too, and "not yet released to our monteur"
  is internal workflow, not customer information.
- No new filter for now (the chip makes rows scannable; a filter is a follow-up
  if the office asks).

### i18n
- One new key used by both spots: `workOrders.status.notDispatched`
  (nl "Niet verzonden", en "Not dispatched"), nl + en.
- Detail header reuses the existing `workOrders.status.*` labels for the
  status badge.

## 3. Decisions on record
- Technicians DO see the chip (it explains their read-only state at a glance);
  clients do NOT.
- A signed-off werkbon never shows the chip even if it was somehow never
  dispatched (finished outranks release concerns; office/foreman can legally
  complete undispatched werkbonnen).
- The status badge derivation is untouched — this is display only.

## 4. Tests / verification
- Backend: extend an existing DTO assertion (e.g. in list-filters or
  dispatch-gate suite) to pin `status` on the detail payload and `dispatchedAt`
  on list rows.
- Client: `tsc --noEmit`, i18n sweep (both locales, no drift), `vite build`.
- Manual-by-paste check: undispatched werkbon header shows its own status
  ("Urgent" in your example, not "Done") + "Niet verzonden"; after dispatch the
  chip is gone; client login sees no chip.
