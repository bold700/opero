# Plan: configurable pre-job checklist items

**Ask (client):** "Where do we adjust the pre-job check items? Right now it's
hardcoded." Correct — the 4 items live in `shared/src/prejob.ts` as a compile-time
constant (`PREJOB_CHECK_ITEMS`), labels come from i18n keys, and there is no UI to
change them.

The goal: an **admin can add / edit / reorder / remove** the checklist items for
their organization, and every place that reads the checklist (the werkbon panel,
the dispatch gate, the PDF) uses the org's items instead of the hardcoded list.

## The core architectural problem (why this is a real refactor, not a screen)

The checklist logic is **pure functions that close over the hardcoded array**:

- `isPrejobChecklistComplete(check)` — `PREJOB_CHECK_ITEMS.every(k => check[k])`
- `normalizePrejobCheck(raw)` — keeps only keys in `PREJOB_CHECK_ITEMS`
- `canDispatch(check, photos)` — built on the above

Once items are per-org data, "complete" is no longer knowable from a compile-time
list — these functions must take the **item set** as an argument. Every caller
must pass it. That is the heart of the change; the CRUD screen is the easy part.

### Every read site (traced)

| Site | File | What it does today |
| --- | --- | --- |
| Werkbon panel | `client/.../PreJobPanel.tsx:73` | maps `PREJOB_CHECK_ITEMS` → checkboxes, label via `t("prejob.items.<key>")` |
| Dispatch gate (DTO) | `backend/.../dto.ts:199-200` | `isPrejobChecklistComplete` + `canDispatch` computed into `prejobComplete`/`canDispatch` |
| Toggle validation | `backend/.../routes.ts:825` | rejects a key not in `PREJOB_CHECK_ITEMS` |
| Dispatch route | `backend/.../routes.ts:917` | `canDispatch(normalizePrejobCheck(...), photos)` gates sending the monteur |
| PDF | `backend/.../pdf.ts:60,257` | `PREJOB_NL` label map; iterates stored keys (already tolerates unknown keys via `prejobNl` fallback) |
| Client type | `client/.../api.ts:89-92` | `prejobCheck` map + `prejobComplete`/`canDispatch` booleans |

## Key decisions (with recommendations)

1. **Scope: per-organization** (one checklist the whole company uses), not
   per-werkbon. The client said "adjust the items" — that's org config, like the
   materials catalog. Per-werkbon overrides are a later, separate feature.
2. **Labels become stored free text, not i18n keys.** A custom item the admin
   types ("Steiger gecontroleerd") can't be an i18n key. Consequence, flag to the
   client: **custom items do not auto-translate** nl/en — they render as typed.
   The 4 seeded defaults can keep bilingual labels (see migration). Store an
   optional `labelEn` if we want the seeds to still switch with language;
   custom items just use the single typed label for both.
3. **Item identity = a stable `key`, generated server-side** (slug or uuid), NOT
   the label. So renaming an item's label doesn't orphan the booleans already
   stored on existing werkbonnen (`WorkOrder.prejobCheck` is keyed by item key).
4. **Soft-delete / active flag, not hard delete.** Removing an item must not
   corrupt historical werkbonnen that recorded it. An inactive item stops
   appearing on new/open werkbonnen and no longer counts toward "complete", but
   its stored booleans + PDF history stay intact. (Hard delete only if the client
   insists; soft is the production-safe default.)
5. **"Complete" = all ACTIVE items ticked.** A werkbon created before an item was
   added simply won't have that key — treat missing active-item keys as not done
   (same as today). Reducing the checklist can therefore flip older werkbonnen to
   "complete"; adding an item flips in-progress ones to "incomplete". Acceptable
   and correct — flag it so it's not a surprise.

## Step 1 — Data model

`backend/prisma/schema.prisma`:

```prisma
model PrejobCheckItem {
  id        String   @id @default(uuid())
  orgId     String
  key       String   // stable slug, keys WorkOrder.prejobCheck; never changes
  label     String   // display text (nl / primary)
  labelEn   String?  // optional English; falls back to `label`
  ordinal   Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([orgId, key])
  @@index([orgId])
}
```

Back-relation on `Organization`. One migration + a **data migration** that seeds
every existing org with the current 4 items (see Step 6).

## Step 2 — Shared logic takes the item set

`shared/src/prejob.ts` — the functions stop closing over the constant:

```ts
export function isPrejobChecklistComplete(check, itemKeys: string[]): boolean {
  return itemKeys.length > 0 && itemKeys.every((k) => check?.[k] === true);
}
export function normalizePrejobCheck(raw, itemKeys: string[]): PrejobCheck { … }
export function canDispatch(check, photoCount, itemKeys: string[]): boolean { … }
```

Keep `PREJOB_CHECK_ITEMS` exported ONLY as `DEFAULT_PREJOB_ITEMS` (id/label/ordinal
seed data) for the migration + fallback — nothing computes against it anymore.
Update all callers to pass the org's active keys.

Note: an empty checklist means `isPrejobChecklistComplete` is **false** (can't
dispatch). Decide with the client: is "no items configured" a valid state that
blocks dispatch, or should an empty list mean "no gate"? Recommend **blocks** by
default (an org shouldn't accidentally disable the safety gate by clearing it) —
but surface it. This is a real behavioural fork, not a detail.

## Step 3 — Backend: load items + rewire the gate

- A small helper `getPrejobItems(orgId)` → active items ordered by `ordinal`
  (cached per request is fine).
- `dto.ts`: load the org's items; emit them **with labels** on the DTO so the
  client renders any item without an i18n key:
  `prejobItems: { key, label, labelEn }[]` alongside the existing `prejobCheck`
  map. Compute `prejobComplete`/`canDispatch` from the active keys.
- Toggle route (`routes.ts:824`): validate `key` against the org's active item
  keys, not the constant.
- Dispatch route (`routes.ts:917`): pass the org's active keys to `canDispatch`.
- **PDF** (`pdf.ts`): the werkbon PDF is built server-side — pass the org's item
  labels through so `prejobNl` uses real labels instead of the hardcoded
  `PREJOB_NL` map. (The existing humanize fallback already prevents breakage; this
  makes custom items read correctly.)

## Step 4 — Backend: admin CRUD

New `backend/src/modules/prejob-check/` (or fold into `organization`), admin-only
(`requireRole("admin")`), org-scoped:

- `GET /prejob-items` — list (active + inactive, for the settings screen).
- `POST /prejob-items { label, labelEn? }` — create; server generates a unique
  `key` (slug of label + de-dupe), appends at the end (`ordinal`).
- `PATCH /prejob-items/:id { label?, labelEn?, active? }` — edit label / toggle
  active. **Never** change `key`.
- `POST /prejob-items/reorder { orderedIds }` — persist ordinal order.
- `DELETE /prejob-items/:id` — soft-delete (set `active=false`); hard delete only
  if the client confirms they want history-affecting removal.
- Zod schemas; audit each mutation like the other admin config routes.

## Step 5 — Client

- **Placement (decided): a new admin-only Settings SECTION**, not a top-level
  page. Settings is already the org-config master/detail screen and already has
  the `adminOnly` pattern (used by "Company"). A 4-item checklist doesn't warrant
  its own nav slot (mobile nav already overflows into "Meer"). Concretely:
  - `settings/constants.ts:28` — add `{ id: "prejobChecklist", icon: <checklist
    icon>, adminOnly: true }` to `SECTIONS` (and the `SectionId` union).
  - render a new `PrejobChecklistForm.tsx` in the Settings detail panel, next to
    `CompanyForm` / `PreferencesForm`.
  - `settings.sections.prejobChecklist.*` i18n (title/subtitle), nl + en.
- The form: list rows with label edit, active toggle, reorder (up/down buttons —
  match what the app already uses), an add-item field, remove. Reuse the existing
  settings patterns (`ToggleRow`, `GroupLabel`). Its own `api.ts` calls in the
  settings feature.
- **`PreJobPanel.tsx`**: stop importing `PREJOB_CHECK_ITEMS`; render
  `workOrder.prejobItems` from the DTO, using `item.label` (or `labelEn` when the
  UI language is English) instead of `t("prejob.items.<key>")`.
- **`api.ts`**: add `prejobItems: { key, label, labelEn? }[]` to the `WorkOrder`
  type; `prejobComplete`/`canDispatch` stay as-is (server-computed).
- i18n: the 4 default items keep their existing `prejob.items.*` keys ONLY if we
  choose to special-case seeds; simpler is to drop those keys and let all items
  (including seeds) render from stored labels. Recommend the latter for
  consistency — one code path.

## Step 6 — Data migration (critical, do not skip)

A migration that, for **every existing org**, inserts the current 4 items with
their stable keys + current Dutch/English labels and ordinals 0–3. Without this,
every existing werkbon's checklist vanishes and no one can dispatch. Idempotent
(skip orgs that already have items).

## Step 7 — Tests + verification

- **Shared**: unit-test the three functions with a passed-in item set — empty
  list, partial ticks, all ticked, keys outside the set ignored.
- **Backend**: admin CRUD (create generates a key, reorder persists, soft-delete
  drops it from `canDispatch` but keeps stored booleans); non-admin is 403;
  toggling an item not in the org's set is rejected; a werkbon with a since-removed
  item still serializes and PDFs cleanly.
- Then: `tsc --noEmit` (shared → backend → client, in that order — shared changes
  ripple), full backend `vitest run`, `vite build`.

## Order of work

1. Confirm the 3 decisions with the client: soft vs hard delete, empty-list
   behaviour, and whether seed items should stay bilingual.
2. Model + data migration seeding existing orgs.
3. Shared functions take the item set; rewire all backend callers + PDF.
4. Admin CRUD routes + tests green.
5. Settings screen + PreJobPanel rewire + i18n.
6. Full typecheck / suite / build.

## Explicitly out of scope

- Per-werkbon checklist overrides (org-level only for now).
- Auto-translation of custom item labels (they render as typed).
- Reworking the pre-job PHOTO requirement — only the checklist ITEMS become
  configurable; "at least one photo" stays as the second half of the gate.
