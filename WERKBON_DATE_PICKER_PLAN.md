# Werkbon date fields — picker UX + save semantics (rev 3)

**Status:** rev 3 proposed — awaiting approval. Supersedes rev 2.
**Scope:** frontend only, one file (`ProjectInfoPanel.tsx`) plus the shared `DateField`.

## Rev 2 → rev 3: what changed and why

Field evidence (arrow clicks closed the picker under the ORIGINAL code) shows
that in Chrome, navigating months/years with a date already selected can update
the input's value live and fire `change` per navigation step. Rev 2 assumed
navigation fires nothing — under that assumption its commit-on-change +
`key`-remount-after-save would have saved mid-navigation and the remount would
have closed the picker again (a remount kills an open picker exactly like
`disabled` did).

Rev 3 therefore adds two hard rules:

1. **While the field has focus, nothing may touch it.** No `disabled` flip, no
   remount, no programmatic value write. Server-state sync happens only when
   the field is NOT focused. With that invariant, it no longer matters whether
   navigation fires change events — the picker cannot be closed by us, period.
2. **Debounced commit (~500 ms).** Navigation-fired changes collapse; the save
   lands once, after the user stops. A day-pick (which closes the picker
   itself) saves ≤0.5 s later — effectively immediate. Navigation never causes
   a visible save mid-interaction.

## Where rev 1 landed, and what it got wrong

Shipped in rev 1 and **correct — stays**:

- `DateField` (`client/src/components/DateField.tsx`): whole field opens the
  calendar via `showPicker()` on click/focus, not just the 16px icon. Applied to
  all 5 date inputs.
- `disabled={busy}` removed from the werkbon date fields. This was the actual
  cause of "the picker closes when I click next month": a PATCH flipped `busy`,
  disabling the focused input, and a disabled input loses focus → the browser
  force-closes the native picker. Verified: month/year navigation fires **no**
  `change` event, so with the disable gone, an open picker can no longer be
  interrupted by a save.

Shipped in rev 1 and **wrong — replaced by this plan**:

- Commit on **blur only**. Picking a date in the calendar then looks unsaved
  until you click elsewhere. Users (correctly) expect pick = saved.

## How established UIs behave

The convention (MUI X DatePicker's `onAccept`, booking-site date fields,
autosave forms generally):

1. **Accepting a date from the picker saves immediately.** Picking a day closes
   the native picker and fires exactly one `change` — that's the accept signal.
2. **Typed input saves on blur** (or Enter), not per keystroke.
3. **The field is never disabled by its own save.**

The one native-input wrinkle: while *typing* a year, `change` fires on
intermediate values (`0002`, `0020`, `0202` on the way to `2026`). So "commit on
change" needs a sanity guard, otherwise garbage dates get PATCHed mid-typing.

## Plan — debounced hybrid commit, hands-off-while-focused

In `ProjectInfoPanel.tsx`, both date fields:

- **`onChange`:** if the value is empty-or-complete with a year in
  `[1990, 2100]`, (re)start a **~500 ms debounce**; on fire, commit if it
  differs from the last committed value. Day-pick → picker closes itself →
  save lands ≤0.5 s later. Month/year navigation that fires changes → each
  step resets the debounce → **no save until the user stops**, and even when
  one lands it cannot disturb the picker (rule below). Half-typed years fail
  the guard → no garbage PATCH.
- **`onBlur` / Enter:** cancel the debounce and commit immediately (including
  cleared → `null`) if it differs. Catches typed input.
- **Hands-off while focused:** the input is uncontrolled with a **stable key**
  (werkbon id only — no value-keyed remount). Server → field sync runs in an
  effect ONLY when the field is not focused. While the user is in the field or
  its picker, we never disable, remount, or write to it.
- **Dedupe via a ref** with the last committed value (change-then-blur, and the
  server echo, must not re-PATCH).
- Keep: `disabled={!canEdit}` (never `busy`), the `!plannedDate` guard and
  `min` on Einddatum.

No backend changes — PATCH is idempotent and both payload shapes are already
verified live. The other four `DateField` call sites keep their existing commit
semantics (dialogs commit on submit; the filter bar applies locally) — they
already behave like rev 2 wants.

**Rejected alternative:** adopting `@mui/x-date-pickers` for real
`onAccept`/`onClose` semantics. It's the textbook tool, but it drags in a new
dependency + locale adapter + theming for exactly the behaviour the hybrid gives
us on the native input, and this repo deliberately uses native inputs everywhere
else.

## Verification

`tsc --noEmit` + `vite build`; manual check (no browser tests in this repo):
1. Click field → calendar opens. 2. Navigate months/years repeatedly → picker
stays open the whole time, no save fires mid-navigation. 3. Pick a day → picker
closes, saves within ~0.5 s (activity row appears, no click-outside needed).
4. Type a date incl. slow year entry → no save until complete + pause/blur,
then exactly one save. 5. Clear the field, blur → date removed, werkbon off the
planning. 6. While the picker is open, let an unrelated mutation finish
elsewhere → picker unaffected.
