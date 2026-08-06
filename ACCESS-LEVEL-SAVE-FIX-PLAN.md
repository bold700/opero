# Plan: access level in the employee dialog must commit on Save

Status: **proposal — awaiting approval.** Nothing built yet.

## 1. The issue, precisely

In "Medewerker bewerken", picking a different **Toegangsniveau** fires a PATCH
immediately and shows a toast ("Access level changed to …") — while every other
field in the same modal (name, phone, job title, status) is staged and only
committed by **Opslaan**. Same control style, opposite commit behaviour, no
warning. Cancel doesn't undo it. That's the bug: a form field that acts like a
button.

## 2. Root cause (traced)

- `client/src/features/users/components/AccountSection.tsx` (~line 175): the
  access-level `SelectField`'s `onChange` calls `onChangeRole(v)` directly.
- `client/src/features/employees/Employees.tsx` (`handleChangeRole`, ~line 227):
  that callback immediately calls `updateUserRole(...)` (PATCH `/users/:id`),
  toasts, and refreshes.

Why it's like this: the Account box was designed as a **live management panel**
(invite / resend / disable / enable are all instant actions), and the role
dropdown was added into it with the same instant semantics. For the buttons
that's fine — they read as actions. For a dropdown sitting in a dialog with a
Save button, it isn't.

Scope: employees only. The customer dialog reuses `AccountSection` but omits
`onChangeRole` (customers are always `client`), so it renders read-only there.

## 3. The fix — stage the level, commit on Opslaan

### Behaviour after the fix

- Changing Toegangsniveau updates **local dialog state only**. No request, no
  toast.
- The dialog counts it toward "has changes": Opslaan lights up, Annuleren (or
  closing) discards it.
- Opslaan saves the employee fields as today **and**, if the staged level
  differs from the account's current one, calls `updateUserRole` as part of the
  same save flow. One success toast.
- The lifecycle **buttons stay immediate** (Uitnodigen, Opnieuw sturen,
  Uitschakelen, Inschakelen): they are explicit actions with their own
  confirmations and don't pretend to be form fields. Only the dropdown moves to
  staged.

### Changes per file

1. **`AccountSection.tsx`** — make the role select controlled from outside:
   - New props: `roleValue: StaffRole` (staged value) replaces reading
     `account.role` directly; `onChangeRole` keeps its signature but is now
     documented as "stage only".
   - No API knowledge here; purely presentational. Everything else unchanged.

2. **`EmployeeDialog.tsx`** — own the staged value:
   - Add `accessRole` state, seeded from `employee.account?.role` on open (and
     re-seeded if the account changes underneath, e.g. after Uitschakelen).
   - `hasChanges` becomes `dirty || accessRoleChanged` where
     `accessRoleChanged = !!account && accessRole !== account.role`.
   - `handleSave` passes the staged level up:
     `onSubmit(input, { accessRole: accessRoleChanged ? accessRole : undefined })`
     — or a second callback `onSaveAccessRole`; pick whichever reads cleaner,
     but the commit must ride the same Save click.

3. **`Employees.tsx`** — commit on save, not on change:
   - `handleSubmit` (the dialog's save handler): after `updateEmployee`
     succeeds, if a staged level was passed, call `updateUserRole`. Sequential,
     employee first.
   - **Partial-failure rule:** if the employee PATCH succeeds but the role
     PATCH fails, keep the dialog open, show the role error in the dialog's
     error slot, and re-seed the staged value from the server response — the
     name edit is saved, the level visibly isn't. No silent half-state.
   - Delete `handleChangeRole` and the `users.toast.roleChanged` toast usage
     from this flow (key stays if used elsewhere; otherwise remove from both
     locales).

4. **Interaction with the lifecycle buttons** — two edges:
   - **Uitschakelen with a staged level:** disabling revokes the login; the
     staged change is meaningless afterwards → re-seed staged value from the
     account state after any lifecycle action resolves.
   - **Self / outranked:** unchanged — the picker is already hidden there, so
     nothing can be staged.

5. **i18n** — remove `users.toast.roleChanged` if it loses its last consumer;
   the generic saved toast covers it.

### Explicitly rejected alternatives

- **Confirm-dialog on change, keep it instant** — still commits outside Save;
  the complaint is the commit timing, not the missing warning.
- **Move the level picker out of the modal** (row action / separate dialog) —
  heavier UX for no gain; the reviewer's model ("manage permissions through
  account access level" inside the employee card) is fine, only the timing is
  wrong.

## 4. Verification

- Client `tsc --noEmit` + `vite build`.
- Backend untouched (PATCH `/users/:id` already exists and is level-guarded;
  office-role.test.ts keeps pinning who may change whom).
- Manual-by-API check: stage a change + Cancel → GET shows old role; stage +
  Save → employee fields and role both updated; role PATCH forced to fail
  (e.g. outranked) → employee saved, dialog shows error, staged value re-seeded.
