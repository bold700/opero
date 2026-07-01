# Change Password (in-app) — Comprehensive Plan

Let a logged-in user change their own password from **Settings → Security**. Verify the current
password, set a new one, revoke *other* sessions but keep the current one alive (no self-logout).

---

## 0. What exists today (audited)

- **No change-password endpoint.** Only `POST /reset-password` (token-based, for the forgot flow).
- **Helpers ready:** `hashPassword(plain)` + `verifyPassword(plain, hash)` in `auth/service.ts`.
- **Reset-password shows the pattern to mirror:** update `passwordHash`, then
  `prisma.authSession.updateMany({ where: { userId, revoked: false }, data: { revoked: true } })`
  to kill sessions.
- **Session model:** refresh tokens are DB-backed `authSession` rows; `consumeRefreshToken`
  rejects `revoked` ones. Access tokens are short-lived JWTs (`JWT_ACCESS_TTL`) — valid until
  expiry, but the client silently refreshes, and a revoked refresh token → refresh fails →
  `onAuthExpired()` → login screen.
- **`issueSession(userId, role, orgId)`** mints a fresh `{ accessToken, refreshToken }` pair —
  exactly what we need to re-issue the current session after revoking others.
- **Client tokens:** `setTokens()` / `getRefreshToken()` in `lib/api/tokens.ts` (localStorage).
- **Security tab already exists** (`SecurityForm.tsx`) — change-password slots in as a second
  group under 2FA.

---

## 1. The key design decision — don't log the user out of the session they're using

Naïvely revoking *all* sessions (like reset-password does) would revoke the current session too →
the next silent refresh fails → the user is bounced to login right after changing their password.
Bad UX.

**Correct behaviour:** revoke **all other** sessions (security best practice — a leaked session
elsewhere shouldn't survive a password change), but **keep the current one** by issuing a **fresh
token pair** and returning it. The client swaps in the new tokens and stays logged in.

Mechanism: the client sends its **current `refreshToken`** in the change-password request. The
server (a) revokes every session for the user, then (b) issues a brand-new session and returns
`{ accessToken, refreshToken }`. The old current refresh token is now revoked, but the client
immediately replaces it with the new pair. Net: other devices are logged out, this one isn't.

---

## 2. Shared schema (`@opero/shared/schemas.ts`)

```ts
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),   // match reset-password's min(8)
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
```
Client-side, also enforce "new ≠ current" and a confirm-field match (UX), but the server is the
source of truth for the min length.

---

## 3. Backend — `POST /auth/change-password` (requireAuth)

Body: `{ currentPassword, newPassword, refreshToken }` (refreshToken so we can re-issue the
current session). Flow:
1. Load the user; `verifyPassword(currentPassword, user.passwordHash)` → 401 on mismatch.
2. Reject if `newPassword === currentPassword` → 400 (`"New password must be different"`).
   (min length is enforced by the schema.)
3. `prisma.$transaction`:
   - `user.update({ passwordHash: await hashPassword(newPassword) })`
   - revoke ALL sessions: `authSession.updateMany({ where: { userId, revoked: false }, revoked: true })`
   - `audit(tx, user, "user.password.change", "user", user.id)`
4. Issue a fresh session (`issueSession`) and return `{ accessToken, refreshToken }` so the
   caller stays logged in.
5. Rate-limit consideration: this is authed, low-risk; the existing `authRateLimit` is for
   unauthed brute-force. A logged-in user guessing their own current password is not a threat.
   Leave un-throttled (or a light limit) — decide during build; default: no extra limit.

Mount: it's on the existing `authRouter` (already mounted at `/api/auth`). No index.ts change.

Security notes:
- Never log or return the password. Audit records only the event, not values.
- Generic 401 message for a wrong current password (don't distinguish "user not found").

---

## 4. Client — API

`lib/api/auth.ts`:
```ts
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const refreshToken = getRefreshToken();
  const res = await api.post<{ accessToken: string; refreshToken: string }>(
    "/auth/change-password",
    { currentPassword, newPassword, refreshToken },
  );
  setTokens(res.accessToken, res.refreshToken);  // swap in the fresh session → stay logged in
}
```
(`getRefreshToken`/`setTokens` already imported in auth.ts.)

---

## 5. Client — UI in the Security tab

Add a **"Password"** group to `SecurityForm.tsx` (above or below the 2FA group), OR a small
`ChangePasswordForm.tsx` component (one component per file — lean: its own file, rendered inside
SecurityForm). Fields:
- Current password
- New password
- Confirm new password

Validation (client, using the existing `useForm` + validation helpers where they fit):
- all three required
- new password min 8 (mirror server)
- confirm must equal new
- new must differ from current (nice inline check)

On submit → `changePassword(current, new)`:
- success → clear the fields, toast ("Password changed"), stay logged in.
- 401 → inline error on the current-password field ("Current password is incorrect").
- 400 (same password / too short) → inline error on the new-password field.

UI: match the app's form language (GroupLabel, fieldGrid, tokens). A **Save/Change password**
button gated on `isValid`. Password inputs `type="password"`, `autoComplete="new-password"` /
`"current-password"`.

---

## 6. i18n (NL + EN)

Under `settings.security.*` (the section already exists): `password` (group label),
`currentPassword`, `newPassword`, `confirmPassword`, `changePassword` (button), `passwordChanged`
(toast), `wrongCurrent`, `passwordsDontMatch`, `passwordTooShort`, `sameAsCurrent`. English keys,
Dutch + English values.

---

## 7. Verification (curl + tests, no browser)

- **curl lifecycle** with a throwaway user:
  1. login → get tokens.
  2. `POST /change-password` with WRONG current → 401.
  3. with a too-short new password → 400 (schema).
  4. with new === current → 400.
  5. with a valid new password (+ the current refreshToken) → 200, returns a fresh token pair.
  6. **old refresh token is now revoked** → `POST /refresh` with the OLD token → 401.
  7. **new tokens work** → `GET /me` with the returned accessToken → 200.
  8. login with the NEW password → success; login with the OLD password → 401.
- **Integration test** covering wrong-current (401), success + re-issued session, old-token
  revoked, login-with-new-password.
- `tsc` (shared/backend/client) + `vite build` + full `vitest` green.
- Clean up the throwaway user. Do NOT change any seeded demo account's password (would break the
  known "opero123" demo logins) — verify only with a throwaway user.

---

## 8. Build order

1. Shared `changePasswordSchema`.
2. Backend `POST /auth/change-password` (verify → update → revoke all → re-issue current). curl it.
3. Client `changePassword()` API (swaps in fresh tokens).
4. `ChangePasswordForm.tsx` + render inside `SecurityForm`.
5. i18n NL + EN.
6. Verify (§7): curl lifecycle + integration test + tsc/build. Clean up.

---

## 9. Open questions (defaulted)

1. **Revoke-others vs keep-all:** default **revoke all other sessions, keep current** (§1) — the
   secure + non-annoying choice. (Alternative: keep all sessions — simpler but less secure; not
   chosen.)
2. **Password strength rules:** default **min 8** (mirrors reset-password). No complexity rules
   for now (the client audience is small/known). Can tighten later.
3. **Confirm-field:** client-only (server doesn't need it). Included for UX.

---

## Out of scope (v1)
- Password strength meter / complexity policy.
- "Log out all other devices" as a separate explicit control (it happens implicitly here).
- Breached-password check (HIBP) etc.
- Forgot-password pages (#10) — separate item, blocked on real email (#11).
