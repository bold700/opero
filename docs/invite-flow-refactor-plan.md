# Invite flow refactor — investigation + plan

Status: **IMPLEMENTED** (2026-08-01) — see "What shipped" at the bottom.
Date: 2026-08-01

## The three reported problems

1. **Creating an employee with an email immediately sends the invite email.**
2. **The emailed link points to `http://localhost:3000` in production.**
3. **The link is a `/reset-password?token=…&invite=1` URL — invites piggyback on the
   password-reset flow, and the email body itself is low-quality (bilingual text pasted
   twice, plain text, no branding).**

All three confirmed. Root causes below, then the plan.

---

## Investigation findings

### 1. Why the email is sent immediately on employee create

`POST /employees` ([backend/src/modules/employees/routes.ts:334](../backend/src/modules/employees/routes.ts))
unconditionally calls `autoInviteEmployee(user, created, accessRole)` after creating the
Employee row. That function
([backend/src/modules/users/provisioning.ts:134](../backend/src/modules/users/provisioning.ts))
does two things in one breath whenever the employee has an email:

1. creates the `User` row (status `invited`, unusable password), and
2. **calls `deliverInvite()` → issues a token → `sendInviteEmail()`** — the email fires.

There is no flag, no checkbox, no confirmation. Typing an email address into the
new-employee dialog IS the invite. The code comment says this was built to a client
request ("when an employee is created, an account should automatically be created for
them" — WOB Isolatie, 17-07-2026), but the implementation conflated *creating the
account* with *delivering the invite email*. Those are separable — and the new
requirement is: **no email leaves the system unless the admin explicitly invites.**

The client dialog ([EmployeeDialog.tsx](../client/src/features/employees/components/EmployeeDialog.tsx))
even shows an access-role selector when an email is typed — but never says "an invite
email will be sent". The admin has no idea it's about to happen.

**Customers: NOT affected.** The customers module has zero invite code. Customer logins
are only created via the explicit `POST /users/invite` action (the Invite button in the
customer dialog). Employee create is the only auto-send path.

Other senders (all fine — these ARE explicit user actions):
- `POST /users/invite` — the Invite button (employees + customers)
- `POST /users/:id/resend-invite` — the Resend button
- `POST /auth/forgot-password` — user-initiated reset

### 2. Why the link says localhost in production

[backend/src/env.ts:16](../backend/src/env.ts):

```ts
APP_URL: z.string().default("http://localhost:3000"),
```

Every emailed link is built from `env.APP_URL`
(invite: [provisioning.ts:26](../backend/src/modules/users/provisioning.ts);
reset: [auth/routes.ts:385](../backend/src/auth/routes.ts);
verify-email: [auth/routes.ts:320](../backend/src/auth/routes.ts)).

The deployed backend environment simply doesn't set `APP_URL` (the local
`backend/.env.prod` template doesn't contain it either), so the zod **default silently
kicks in — in production**. Email sending meanwhile works because `RESEND_API_KEY` +
`EMAIL_FROM` *are* configured on the deployed host. So real emails go out with dev
URLs inside. A misconfiguration that should have been a boot-time crash was instead
papered over by a convenience default.

### 3. Why it's a reset-password link

By design-shortcut: `issueInvite()`
([backend/src/auth/tokens.ts:105](../backend/src/auth/tokens.ts)) writes into the same
`PasswordReset` table as a real reset, just with a 7-day TTL instead of 1 hour. The
invite email links to `/reset-password?token=…&invite=1`, and the client page
([ResetPassword.tsx](../client/src/features/auth/ResetPassword.tsx)) switches its copy
to "set up your account" when `invite=1`. `POST /auth/reset-password` activates a user
whose status is `invited` as a side effect.

Sharing the token *mechanism* (opaque random token, hashed at rest, single-use) is
fine. Exposing the invite as a **reset-password URL** is not: it looks broken/phishy to
the recipient, the `invite=1` flag is cosmetic (anyone can strip it), and the flows have
different semantics (an invite should show who you are / which org you're joining; a
reset shouldn't).

### 4. Email content quality

[provisioning.ts:25-34](../backend/src/modules/users/provisioning.ts): a single
plain-text body with the Dutch text and the English text concatenated, a slash-subject
("Opero — je bent uitgenodigd / you've been invited"), no HTML part, no expiry
formatting, no sender identity beyond the raw link. Same pattern in forgot-password and
verify-email. This is what produced the double "Hello Kevin Klatt / Hi Kevin Klatt"
email.

---

## Refactor plan

### Phase A — stop the bleeding (behavioral fixes)

**A1. Remove auto-invite from employee create. The existing Invite button IS the flow.**

There is already a complete, explicit invite flow: the **Invite button** in the edit
employee/client dialog (`AccountSection` → `InviteDialog` → `POST /users/invite`),
available to both office and admin (per-target guarded by `canGrantRole` /
`canActOnAccount`). It creates the login AND sends the email, with role selection
built in. Nothing new is needed — the bug is that employee create does a second,
implicit version of it. So delete that path outright:

- `POST /employees` ([employees/routes.ts:334](../backend/src/modules/employees/routes.ts)):
  remove the `autoInviteEmployee` call and the `invite` field from the response.
  Creating an employee creates an employee. Nothing else.
- Delete `autoInviteEmployee` from
  [provisioning.ts](../backend/src/modules/users/provisioning.ts) (and its
  `AutoInviteResult` type + `auto-invite.test.ts`).
- Remove `accessRole` from `createEmployeeSchema` and its `canGrantRole` pre-check in
  the route — role choice lives in the InviteDialog, where it already exists.
- [EmployeeDialog.tsx](../client/src/features/employees/components/EmployeeDialog.tsx):
  remove the create-only access-role selector block (lines ~250-267) and its state.
  **No new UI.** The dialog's existing Account panel with the Invite button stays
  exactly as it is.
- [Employees.tsx](../client/src/features/employees/Employees.tsx): drop the
  auto-invite toast branches (`createdInvited` / `inviteFailed.*`); plain
  "created" toast remains. Remove the now-dead i18n keys.

Net effect: to give someone access you open the employee/client, hit **Uitnodigen**,
pick the role, done — the flow that already exists, now the ONLY flow. The
`no_account` filter chip already answers "who still needs an invite".

**A2. `APP_URL` must be required in production.**

In `env.ts`, replace the blanket default with a refinement:

```ts
.superRefine((env, ctx) => {
  if (env.NODE_ENV === "production" && !process.env.APP_URL) {
    ctx.addIssue({ ... "APP_URL is required in production" });
  }
})
```

(keep the localhost default for dev/test only). Same treatment for `PUBLIC_API_URL` if
uploads are used in prod. Boot fails loud instead of emailing localhost links.
**Ops task:** set `APP_URL=https://<deployed-client-origin>` in the deployed backend
environment, and add it to `backend/.env.example` + `.env.prod` template.

### Phase B — first-class invite flow

**B1. Dedicated invite token + route.**

- New client route `/accept-invite?token=…` (English internals; Dutch copy via i18n),
  new page `features/auth/AcceptInvite.tsx` — proper "Welkom bij Opero, stel je
  wachtwoord in" framing. Kill the `invite=1` hack in `ResetPassword.tsx`.
- Backend: keep the hashed-single-use-token mechanism but give invites their own
  identity. Either a `purpose` column (`invite` | `reset`) on `PasswordReset` (rename
  model to `ActionToken` optional) or a separate `Invite` table. Recommended minimal:
  **`purpose` enum column**, so:
  - `POST /auth/reset-password` only consumes `purpose=reset` tokens (a stale invite
    link can't be replayed through the reset endpoint or vice versa).
  - New `POST /auth/accept-invite { token, password }` consumes `purpose=invite`,
    activates the user, sets `activatedAt`, revokes sessions.
- Invite email links to `${APP_URL}/accept-invite?token=…`.
- Expiry stays 7 days for invites, 1 hour for resets.

**B2. Proper transactional emails.**

- Add a tiny template layer in `backend/src/lib/email.ts` (or `email-templates.ts`):
  branded HTML + plain-text fallback, one template per message
  (`inviteEmail`, `passwordResetEmail`, `verifyEmail`). English-keyed builders with
  Dutch label maps at render time (per project rule — Dutch is display-only).
- Single-language body (Dutch — the product's user base), not the NL+EN concatenation.
  Subject: "Je bent uitgenodigd voor Opero".
- Include: who invited you (org name), what Opero is in one line, a real button/link,
  expiry ("Deze link verloopt over 7 dagen"), and a "didn't expect this? ignore it"
  footer.
- Send via Resend `html` + `text` fields.

**B3. Tests to update/add.**

- `employees/auto-invite.test.ts` — replace with a test asserting the opposite:
  creating an employee with an email creates NO user row and sends NO email.
- `modules/provisioning.test.ts` — activation moves to `/auth/accept-invite`; assert
  reset endpoint rejects invite tokens and vice versa.
- New: env validation test — production without `APP_URL` refuses to boot.
- `auth/auth.test.ts` — reset flow unchanged for `purpose=reset`.

### Phase C — cleanup / hardening (small, do in the same pass)

- Migration: backfill existing `PasswordReset` rows (`purpose=reset`; rows with 7-day
  expiry created via `issueInvite` → `purpose=invite`, or simply let outstanding ones
  expire and default backfill to `reset`).
- `verify-email` and `forgot-password` emails get the same template treatment (B2).
- Data cleanup: existing `invited` users created by the old auto-invite whose owner
  never wanted them can be disabled from the UI as-is; no migration needed.
- `backend/.env.example`: document `APP_URL` as REQUIRED in production.

### Execution order

| Step | Scope | Risk |
|------|-------|------|
| A2 env guard + ops `APP_URL` | env.ts + deploy env | none — pure config guard |
| A1 remove auto-invite | employees routes/schema, provisioning.ts, EmployeeDialog, Employees toasts, i18n keys | low |
| B1 accept-invite flow + token purpose | tokens.ts, auth routes, prisma migration, new client page, router | medium |
| B2 email templates | lib/email.ts + call sites | low |
| B3+C tests, backfill, cleanup | tests, migration, .env.example | low |

Verification per project rules: `tsc --noEmit` both workspaces, `vite build`, vitest
backend suite, curl against dev API. No browser tests.

---

## What shipped

All phases implemented and verified on 2026-08-01.

### Bug 1 — employee create sent the email

`POST /employees` no longer provisions anything. `autoInviteEmployee` and
`AutoInviteResult` are deleted, `accessRole` is gone from `createEmployeeSchema`, and the
route's `canGrantRole` pre-check went with it. The response is a plain employee DTO with
no `invite` field. On the client the create-only access-level selector is removed from
`EmployeeDialog`, `EmployeeInput.accessRole` is dropped, and `Employees.tsx` shows the
plain "created" toast (the `createdInvited` / `inviteFailed.*` keys are deleted from both
locales). Customers were already clean — verified, not assumed.

The Invite button is untouched and is now the only path: `POST /users/invite`, role chosen
in `InviteDialog`, available to office and admin, guarded by `canGrantRole` /
`canActOnAccount` exactly as before.

### Bug 2 — localhost links in production

`APP_URL` is now validated as a URL and **required when `NODE_ENV=production`** via a
`superRefine` on the env schema; the dev default only applies outside production. A deploy
missing it fails at boot with an actionable message instead of mailing dead links.
Documented in `.env.example` and filled in `.env.prod`
(`APP_URL="https://werkbon-client.vercel.app"`).

**Ops step still required:** set `APP_URL` on the deployed backend host. Until then the
deployed API will now refuse to start — deliberately, and better than the alternative.

### Bug 3 — reset-password links and slop emails

- New `ActionTokenPurpose` enum (`invite` | `reset`) on `PasswordReset`, migration
  `20260801191900_action_token_purpose`, including a backfill that classifies outstanding
  long-lived unused tokens as invites so invitations already in inboxes still work.
- `consumeActionToken(raw, purpose)` replaces the shared consume path. A token presented
  at the wrong endpoint is rejected **and left unspent**, so a misdirected click doesn't
  cost the recipient their only link.
- New `POST /auth/accept-invite` activates `invited` → `active`. `POST /auth/reset-password`
  no longer activates anyone; it only resets. An already-active or disabled account cannot
  be activated through an old invite.
- New client page `features/auth/AcceptInvite.tsx` at `/accept-invite`; the `?invite=1`
  hack is gone from `ResetPassword.tsx`. The shared two-field form is extracted to
  `features/auth/components/SetPasswordForm.tsx` (one component per file).
- New `lib/email-templates.ts`: branded inline-CSS HTML + plain-text alternative, single
  language, escaped interpolation. The invite names the organisation and the inviter (a
  cold email with a bare link reads as phishing), states the 7-day expiry, and carries an
  "ignore this" footer. `forgot-password` and the email-change confirmation use the same
  shell. `Email` gained an optional `html` field, passed through to Resend.

### Verification

- Backend `tsc --noEmit`, client `tsc --noEmit`, shared `tsc --noEmit`, `vite build` — all clean.
- `vitest run`: 266 passed / 34 files. New suites: `employees/no-auto-invite.test.ts`
  (no user row, no email, ignores a smuggled `accessRole`) and `auth/token-purpose.test.ts`
  (both cross-purpose rejections, unspent-on-rejection, replay, and that the invite mail
  links to `/accept-invite` and never `/reset-password` in both parts).
- Live curl against the dev API: employee-with-email → no user row, no mail; explicit
  invite → login created; invite token at `/reset-password` → 400; same token at
  `/accept-invite` → 204; login with the chosen password → 200; replay → 400; customer
  create → no account. Test records cleaned up afterwards.
- Env guard exercised for all three cases (production unset → refuses; production set →
  boots; development unset → dev default).

Note: `office-role.test.ts` "gets the operational dashboard" is intermittently slow and
fails on its 5s timeout roughly one run in three. It is pre-existing and untouched by this
work; tracked separately.
