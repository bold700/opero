# Save button should be disabled until something actually changes

Status: **IMPLEMENTED** (2026-08-02) — see "What shipped" at the bottom.
Date: 2026-08-02

## The complaint

Open **Edit employee** or **Edit client**, change nothing — the **Opslaan** button is
enabled. Clicking it fires a PATCH that writes the same values back. The button implies
there is something to save when there isn't.

The same defect is in every edit form in the app, so this plan fixes all of them.

## Investigation findings

### Why it happens

Save buttons gate on *validity* and *busy*, never on *change*:

- [CustomerDialog.tsx:262](../client/src/features/customers/components/CustomerDialog.tsx) —
  `disabled={busy || !isValid}`
- [EmployeeDialog.tsx](../client/src/features/employees/components/EmployeeDialog.tsx) —
  `disabled={busy || !isValid}`

`isValid` is true the instant the form is seeded from a valid saved record, so the button
is live on open. Nothing tracks the seeded values, so "unchanged" is not a state any of
these forms can express.

[`useForm`](../client/src/lib/useForm.ts) holds `values` and `touched` but **never keeps
the values it was seeded with**: `reset(next)` calls `setValues(next)` and discards the
previous baseline. `touched` is close but wrong — it means "the user typed in this field"
and stays true after they type a character and delete it again.

### Full audit — every save button in the app

| # | File | Current gating | Verdict |
|---|---|---|---|
| 1 | `CustomerDialog.tsx` | `busy \|\| !isValid` | **fix** — reported |
| 2 | `EmployeeDialog.tsx` | `busy \|\| !isValid` | **fix** — reported |
| 3 | `CompanyForm.tsx` | `busy \|\| !isValid` | **fix** |
| 4 | `MaterialFormDialog.tsx` | `!canSubmit` (name non-empty) | **fix** |
| 5 | `VariantFormDialog.tsx` | `!canSubmit` (size + price valid) | **fix** |
| 6 | `ProjectFormDialog.tsx` | `!canSubmit \|\| busy`, where `canSubmit = editing ? true : …` | **fix — worst case**, editing is unconditionally submittable |
| 7 | `NotificationsForm.tsx` | `busy` | **fix** |
| 8 | `ProfileForm.tsx` | `busy \|\| !isValid \|\| !dirty` | already correct — refactor onto the shared helper |
| 9 | `ScheduleDialog.tsx` | `Boolean(workOrderId && date) && !dateInPast && !leaderAbsence && !busy` | **leave alone** — see below |

**`ScheduleDialog` is deliberately out of scope.** It is a create/schedule action, not an
edit of an existing record: it starts empty and its gating already requires the user to
have picked a work order and a date. There is no "unchanged" state to protect against.

### There is already a precedent, hand-rolled

[ProfileForm.tsx:84-86](../client/src/features/settings/components/ProfileForm.tsx):

```ts
const dirty =
  !!user && (values.name !== user.name || values.phone !== (user.phone ?? ""));
```

Two fields, so it is tolerable there. Copying that shape outward would mean hand-comparing
**nine** fields in CustomerDialog, eleven in CompanyForm, and twelve in MaterialFormDialog
— the kind of condition that silently rots the moment someone adds a field and forgets to
extend it. The logic belongs in one helper, with `ProfileForm` collapsing onto it.

### Wrinkles the implementation must handle

**1. State outside `useForm`.** `EmployeeDialog` keeps `roles: TeamRole[]` in its own
`useState` because `useForm` is typed `Record<string, string>`. A `dirty` flag from
`useForm` alone would report "unchanged" while the user has just toggled a role. So
`useForm` must expose *its own* dirtiness and let the caller OR in extra conditions —
never pretend to be the whole truth.

**2. Non-string values.** `MaterialFormDialog`, `VariantFormDialog` and `ProjectFormDialog`
hold numbers, `null`s and mixed unions (`thicknessMm: number | null`, `unitPrice: number`).
`NotificationsForm` holds four booleans. The shared comparison therefore cannot be
string-only: it needs a shallow compare that treats `null`/`undefined`/`""` sensibly and
trims only actual strings.

**3. Trim asymmetry.** Submit sends `values.name.trim()` while the baseline stores the raw
string. A record saved with a trailing space would otherwise read as permanently dirty.
Comparison trims strings, matching what submit actually sends. Deliberate consequence:
adding only a trailing space is not a change — correct, since submitting it is a no-op.

**4. `NotificationsForm` never reseeds.** It seeds `prefs` from `user` once via a lazy
`useState` initialiser and, after a successful save, calls `setUser(updated)` without
resetting its baseline. Whatever baseline it compares against must be re-derived from the
saved user, or the button would stay enabled after saving.

## The plan

### Step 1 — one shared comparison helper

New `client/src/lib/isDirty.ts`, exporting a pure function plus a hook:

```ts
// Shallow value comparison for form state. Strings are trimmed (submit trims
// too, so untrimmed whitespace is not a real change); null/undefined/"" are
// treated as the same "empty" so an absent field and a cleared one match.
export function isDirty<T extends object>(current: T, initial: T): boolean;
export function useDirty<T extends object>(current: T, initial: T | null): boolean;
```

Pure function first, hook as a `useMemo` wrapper — so it is testable without a renderer
and usable from both `useForm` and the plain-`useState` dialogs.

### Step 2 — teach `useForm` what it was seeded with

In [useForm.ts](../client/src/lib/useForm.ts):

- Keep the seeded values in an `initialRef` (a ref, not state — it is a baseline and must
  not trigger renders).
- `reset(next)` sets `initialRef.current = next` alongside `setValues(next)`. Every dialog
  already seeds through `reset` in a `useEffect`, so **no call site changes**.
- Return `dirty`, derived via `isDirty(values, initialRef.current)` in a `useMemo`.

Additive only: one new field on the returned object.

### Step 3 — gate every button

| File | Change |
|---|---|
| `CustomerDialog` | `disabled={busy \|\| !isValid \|\| !dirty}` |
| `EmployeeDialog` | `disabled={busy \|\| !isValid \|\| !dirtyAll}` where `dirtyAll = dirty \|\| rolesChanged`; seed an `initialRoles` ref in the same `useEffect` that calls `setRoles`; compare order-insensitively (same members = unchanged) |
| `CompanyForm` | `disabled={busy \|\| !isValid \|\| !dirty}` |
| `ProfileForm` | delete the hand-written `dirty`, use `useForm`'s — the cleanup that proves the abstraction |
| `MaterialFormDialog` | keep an `initialForm` state/ref seeded in the existing `useEffect`; `canSubmit = form.name.trim().length > 0 && !submitting && (!editing \|\| dirty)` |
| `VariantFormDialog` | same shape, preserving the existing size/price validity checks |
| `ProjectFormDialog` | replace `editing ? true : Boolean(customerId)` with `editing ? dirty : Boolean(customerId)`; seed an initial snapshot of the five fields in the existing `useEffect` |
| `NotificationsForm` | seed `initialPrefs` from `user!.preferences.notifications`; `disabled={busy \|\| !dirty}`; **re-seed the baseline after a successful save** (wrinkle 4) |

**Create mode stays unaffected.** New records seed from an empty shape, so `dirty` is false
until the user types — which is desirable anyway. For the `useForm` dialogs `isValid` is
already false there (name required), so behaviour is unchanged. For Material/Variant the
`!editing ||` clause keeps create-mode gating exactly as it is today.

### Step 4 — verification

Per project rules: `tsc --noEmit` (client + shared) and `vite build`. No browser tests.

Add `client/src/lib/isDirty.test.ts` if the client has a test runner configured; if not,
the pure function is at least trivially reviewable — check before adding.

Manual matrix per form:
- open edit, touch nothing → Save disabled
- change a field → Save enabled
- change it back to the original value → Save disabled again (this is exactly what a
  `touched` flag gets wrong, and the reason for value comparison)
- edit only whitespace around a value → stays disabled
- `EmployeeDialog`: toggle a role only → Save enabled
- `ProjectFormDialog`: change only the customer → Save enabled
- `NotificationsForm`: toggle, save, → disabled again without a reload
- `MaterialFormDialog` / `VariantFormDialog`: clear a numeric field to empty → behaves sanely
- create mode everywhere: empty → disabled; fill required fields → enabled
- save succeeds → reopen the dialog → disabled again (baseline reseeded on open)

### Execution order

| Step | Scope | Risk |
|---|---|---|
| 1 | `lib/isDirty.ts` (new, pure) | none — nothing consumes it yet |
| 2 | `useForm` gains `dirty` | none — additive, no call site changes |
| 3a | CustomerDialog, EmployeeDialog, CompanyForm, ProfileForm | low |
| 3b | Material, Variant, Project, Notifications | low — each is one snapshot + one condition |
| 4 | typecheck, build, manual matrix | — |

### Risk

Low and uniform. Each button gains one condition; `useForm` gains one field. The realistic
failure mode is missing a piece of state that lives outside the compared snapshot, which
makes Save stay *disabled* when the user did change something — annoying but immediately
visible, and the manual matrix targets exactly those cases (`EmployeeDialog.roles`,
`ProjectFormDialog.customerId`, the Notifications booleans).

### Out of scope (worth noting, not doing here)

A `dirty` flag also makes an "unsaved changes?" confirmation possible on dialog dismiss —
[ResponsiveDialog](../client/src/components/ResponsiveDialog.tsx) currently closes on
tap-away with no warning, so a mis-tap silently discards edits. Related and now cheap to
build, but a separate behaviour change; not bundled in.

---

## What shipped

Implemented 2026-08-02. All eight affected save buttons now require an actual change.

### New shared helper

`client/src/lib/isDirty.ts` — a pure `isDirty(current, initial)` plus a `useDirty` hook.
Shallow compare over the union of both objects' keys, with the semantics the audit called
for: strings trimmed (submit trims, so trailing whitespace is not a change);
`null`/`undefined`/`""` all treated as empty (forms seed a cleared optional as `""` and the
API returns `null` — that round-trip must not read as an edit); arrays compared as sets,
order-insensitive (reordering the same roles is not an edit); `Object.is` so a `NaN` in a
half-typed number field doesn't mark the form permanently dirty. A `null` baseline reads as
*not* dirty, so an unloaded record leaves Save disabled rather than enabled by accident.

### `useForm` gained a baseline

`initialRef` records what `reset(next)` seeded, and a memoised `dirty` is returned
alongside `isValid`. Every dialog already seeds through `reset` in a `useEffect`, so no
call site needed changing — purely additive.

### Per-form changes

| File | Gating now |
|---|---|
| `CustomerDialog` | `busy \|\| !isValid \|\| !dirty` |
| `EmployeeDialog` | `busy \|\| !isValid \|\| !hasChanges`, where `hasChanges = dirty \|\| rolesChanged` — the roles picker lives outside `useForm` and needed its own `initialRoles` baseline |
| `CompanyForm` | `busy \|\| !isValid \|\| !dirty` |
| `ProfileForm` | hand-written two-field `dirty` **deleted**, now uses `useForm`'s |
| `MaterialFormDialog` | `canSubmit` gained `(!editing \|\| dirty)`; `initialForm` ref seeded in the existing effect |
| `VariantFormDialog` | same shape, original size/price validity preserved |
| `ProjectFormDialog` | `editing ? true` → `editing ? dirty` (the worst case: edits were unconditionally submittable) |
| `NotificationsForm` | `busy \|\| !dirty`, with the baseline advanced on successful save — it never reopens, so without that Save would stay enabled forever after the first save |

`ScheduleDialog` deliberately untouched: it is a create/schedule action with no "unchanged"
state to protect.

### Verification

- `tsc --noEmit` clean in client, shared and backend; `vite build` clean.
- **No client test runner exists** (no vitest/testing-library in `client/package.json`), so
  no unit test was added — adding a whole test stack for this wasn't in scope. Instead the
  pure function was exercised against 20 cases via the backend's `tsx`, covering: the
  reported bug (reopen unchanged → not dirty), edit-then-undo, trailing-whitespace-only,
  `null` ↔ `""` round trips, role add/remove/reorder/swap, number and boolean changes,
  `NaN`, a null baseline, and a key dropped from the form. All 20 passed.

### Pre-existing issue found, not fixed

`pnpm lint` is broken repo-wide: `client/eslint.config.mjs` imports `eslint-config-next`
(a leftover from the Next.js era — this is a Vite app) and that package is in no
`package.json`. It fails identically on files untouched by this work. Left alone as
out-of-scope; worth a separate cleanup.
