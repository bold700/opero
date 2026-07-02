# User Provisioning & Invitations — Comprehensive Plan

Give the app the missing ability to create login accounts, the industry-standard way:
**admin provisions access → system emails an invite → the person activates it by setting their
own password.** Accounts have a real lifecycle (invited → active). No self-signup, no admin
handling passwords.

---

## 0. The model (why this is not a hack)

Three separate concerns, deliberately linked — the standard for every B2B app:

| Layer | In Opero | Status |
|---|---|---|
| **Identity / login** | `User` (email + passwordHash + 2FA + sessions) | ✅ exists |
| **Membership / role** | `User.role` + `orgId` | ✅ exists |
| **Domain record** | `Employee` / `Customer` (a person on the team / a company) | ✅ exists |

`User.employeeId` / `User.customerId` already link identity → domain record. **The schema is
correct.** What's missing is the *lifecycle* that turns "an employee record" into "a person who can
log in" — provisioning + invitation. An **invite is architecturally the same as a password reset**
(a token that lets someone set a password), so we generalize the existing reset machinery rather
than build a parallel one.

Audited facts this plan builds on:
- `PasswordReset { tokenHash, expiresAt, used, userId }` + `issuePasswordReset` / `consumePasswordReset`
  already implement "token → set password." (`auth/tokens.ts`)
- `/reset-password` page + `/auth/reset-password` endpoint already set a password from a token.
- Resend email is wired (`lib/email.ts`); `APP_URL` builds links.
- Login verifies `verifyPassword(password, user.passwordHash)` — we must make a pending user
  unable to pass this.
- `User.passwordHash` is **non-nullable** — a pending user needs a real status field, not a null hash.

---

## 1. The one correct schema addition: user lifecycle state

A user needs an explicit state so a provisioned-but-not-activated account **cannot log in** until
it's activated. This is the missing piece of the model (not a hack — it's the state the model
always implied).

```prisma
enum UserStatus {
  invited     // provisioned by an admin; must activate (set password) to log in
  active      // normal, can log in
  disabled    // access revoked; cannot log in, kept for history
}

model User {
  ...
  status       UserStatus @default(active)   // existing users → active via migration default
  invitedById  String?                       // who provisioned them (audit)
  activatedAt  DateTime?                      // when they set their password
  ...
}
```
- Migration sets all existing rows to `active` (they already have passwords).
- A newly-provisioned user is `invited` with a **placeholder passwordHash that cannot match any
  input** (e.g. a random unusable string) — belt-and-suspenders on top of the status check.

**Login gate:** in `POST /login`, after finding the user, reject unless `status === "active"`.
`invited` → "This account hasn't been activated yet — check your email for the invite."
`disabled` → generic invalid (no enumeration). This closes the "pending user can't log in" hole.

---

## 2. Generalize the token flow: invite = long-lived activation token

Reuse `PasswordReset` as the single "set-password token" mechanism (rename-in-comments only; no new
table). Add an invite issuer that mirrors `issuePasswordReset` but with a longer TTL:
- `issuePasswordReset(userId)` — 1h (unchanged; for resets).
- `issueInvite(userId)` — e.g. 7 days (invites sit in inboxes longer).
Both produce a token consumed by the **same** `consumePasswordReset` → set password. On consume, if
the user is `invited`, flip to `active` + set `activatedAt`. So one activation endpoint serves both
"accept invite" and "reset password."

The emailed link points at the existing set-password page: `APP_URL/reset-password?token=...`
(copy tweaks for the invite context — "You've been invited to Opero" vs "Reset your password").

---

## 3. Backend — provisioning endpoints (new `modules/users` or on `auth`)

All **admin-only, org-scoped**. A user is provisioned FROM a domain record (employee/customer) or
standalone.

- `POST /users/invite` — provision access + send invite.
  Body: `{ email, name, role, employeeId?, customerId? }`.
  - Validate: email not already a user in the org (409 if taken). Role ∈ {admin, technician, client}.
  - If `employeeId`/`customerId` given, verify it's in the org and matches the role
    (technician→employee, client→customer).
  - Create `User { status: invited, passwordHash: <unusable>, role, links, invitedById }`.
  - `issueInvite(user.id)` → `sendEmail(link)`.
  - Returns the created user DTO (status: invited).
- `POST /users/:id/resend-invite` — reissue token + email (for invited users who lost it).
- `POST /users/:id/disable` / `POST /users/:id/enable` — flip status (revoke/restore access). Never
  hard-delete a user with history (audit/activity FKs); disable instead.
- `GET /users` — list org users with status (for the central admin view + to show "has login" on
  employee/customer rows).
- Every mutation is `audit()`-logged.

Guardrails:
- An admin cannot disable/downgrade the last remaining admin (don't let the org lock itself out).
- Don't leak whether an email exists across orgs.

---

## 4. Backend — reflect "has login" on domain records

So the Employees/Customers screens can show login status + the right action:
- Extend `employeeListDto` / `customerListDto` (or the detail DTOs) to include a small
  `account: { userId, status } | null` derived from the linked `User` (the relation already
  exists: `Employee.users`, `Customer.users`). Prices/secrets never leak — it's just status.

---

## 5. Client — where provisioning lives (standard placement)

**Primary: on the record you manage.**
- **Employees screen** — each row shows a login-status chip (No login / Invited / Active). Row
  action: **"Invite"** (→ creates technician-role user linked to that employee + sends email) or
  **"Resend invite"** / **"Disable access"** depending on state. Role is inferred (employee →
  technician; but allow choosing admin for office staff).
- **Customers screen** — same, role = client, linked to the customer.

**Secondary: a central "Users / access" admin view** (Settings → a "Team access" section, or its
own admin route) — lists every login account with status, lets an admin invite standalone users
(e.g. an office admin who isn't an Employee), resend, enable/disable. This is the "see everyone"
surface; the row actions are the "do it in context" surface. (Mirrors GitHub's org People page.)

Client API + components:
- `lib/api/users.ts`: `inviteUser`, `resendInvite`, `disableUser`, `enableUser`, `getUsers`.
- Employees/Customers: status chip + an actions menu per row (Invite / Resend / Disable).
- A small **InviteDialog** (email prefilled from the employee/customer, role, confirm).
- The **central Users view** (table: name, email, role, status, actions).
- All admin-gated (hide for non-admins; backend enforces too).

---

## 6. Client — activation page (reuse, don't rebuild)

The invite link lands on the **existing `/reset-password?token=` page**, which already: reads the
token, takes new+confirm password, calls the set-password endpoint, shows success → go to login.
Only change: detect invite-vs-reset context (a query flag or infer from copy) to show
"Welcome — set your password" instead of "Reset your password." Same code path. On success the user
is `active` and logs in normally.

---

## 7. i18n (NL + EN)
Invite/status copy: status chips (No login / Invited / Active), invite dialog, resend, disable/
enable confirms, the central Users view, the invite email subject/body, and the activation-page
"welcome" variant. English keys; Dutch + English values.

---

## 8. Verification (curl + tests, no browser)
- **Full lifecycle, throwaway data:** admin invites an email → user row exists as `invited` →
  login as that user is **rejected** (not activated) → consume the invite token via set-password →
  user is `active` → login now **succeeds** with the new password.
- Invite an email already taken → 409. Invite with a role/link mismatch → 400.
- Resend invite reissues a working token. Disable → login rejected; enable → works again.
- Last-admin guard: disabling the only admin → blocked.
- Cross-org: an admin can't invite/list/disable another org's users.
- Employee/customer DTO shows correct `account` status.
- Integration test covering invite → activate → login + disabled-can't-login.
- `tsc` (shared/backend/client) + `vite build` + full `vitest` green.
- **Never** touch seed demo accounts; use throwaway users; clean up. Note: prod email delivery
  still depends on the Resend key (#11) — dev logs the link to the console, so it's fully testable.

---

## 9. Build order
1. Schema: `UserStatus` enum + `status`/`invitedById`/`activatedAt` on User + migration (existing → active).
2. Login gate (reject non-active) + `issueInvite` (long-lived token) + activate-on-consume (flip to active).
3. Provisioning endpoints: invite / resend / enable / disable / list (admin, org-scoped, audited, guardrails).
4. Domain DTOs: `account` status on employees/customers.
5. Client API + Employees/Customers status chips + invite/resend/disable actions + InviteDialog.
6. Central "Users / access" admin view.
7. Activation-page copy variant (invite vs reset) — reuse `/reset-password`.
8. i18n NL + EN.
9. Verify (§8) + integration test + cleanup.

---

## 10. Explicitly NOT hacks / and out of scope
- **Not** self-signup (no public register — accounts are admin-provisioned).
- **Not** admin-sets-password (admins never touch credentials; the invitee sets their own). A
  temporary-password fallback is intentionally omitted to keep the credential model clean.
- **Reuses** the existing token + reset page + Resend email — one "set password via token" concept.
- Out of scope (v1, note as follow-ups): SSO/SAML, bulk CSV invite, per-user granular permissions
  beyond the 3 roles, self-serve org signup, recovery/backup codes (already noted for 2FA).
