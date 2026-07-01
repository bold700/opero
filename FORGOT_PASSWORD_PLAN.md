# Forgot / Reset Password — Comprehensive Plan

Complete the self-service password-reset flow: a **"Forgot password?"** page to request a reset,
an emailed **link**, and a **reset page** to set a new password from that link. Wire the dead
login link. Make it fully usable in dev now, and production-ready the moment real email lands.

---

## 0. What exists today (audited)

**Backend — endpoints complete:**
- `POST /auth/forgot-password` (rate-limited, always **204**, no user enumeration): if the email
  matches a user, `issuePasswordReset(userId)` → `sendEmail(...)`.
- `POST /auth/reset-password` `{ token, newPassword }`: `consumePasswordReset(token)` → update
  hash → **revoke all sessions** → 204. Rejects invalid/expired token (400).
- **Token model is solid:** `PasswordReset { tokenHash (unique, hashed at rest), expiresAt, used,
  userId }` — single-use, expiring. Schemas exist (`forgotPasswordSchema`, `resetPasswordSchema`
  with `newPassword.min(8)`).

**The two real gaps:**
1. ⚠️ **Email is a console stub.** `lib/email.ts` logs in dev/test and **throws in production**.
   → The flow works in dev (read the token from the server console) but **cannot deliver in prod
   until a real provider is wired.** This is item #11 (M3).
2. **The email sends the raw TOKEN, not a link.** For a usable flow it should email a
   `…/reset-password?token=<token>` **URL** to the reset page. Needs a frontend base URL.

**Client — nothing exists:**
- `/login` is a standalone public route. **No `/forgot-password` or `/reset-password` pages.**
- The login "Forgot password?" link is `href="#"` (dead, item #4).

---

## 1. The email dependency — how this plan handles it

The flow is **fully buildable and testable now**; only *delivery in production* depends on real
email (#11). This plan:
- Builds the complete client flow (request page → reset page) + wires the login link.
- Changes the email to send a **reset link** (so when email is real, it just works).
- **Dev/test:** the link is printed to the server console by the existing stub → the flow is
  end-to-end testable today (curl reads the token; the page consumes it).
- **Production:** works the instant `sendEmail` is backed by a provider (#11). No further
  password-flow changes needed — this is the whole point of the `sendEmail` abstraction.

So: build it all now; it's dev-complete immediately and prod-complete when #11 lands. The plan
notes the #11 dependency explicitly rather than pretending it's shippable to prod standalone.

---

## 2. Backend changes (small)

### 2a. Email a LINK, not a raw token
- Add a frontend base URL to config: `APP_URL` in `env.ts` (default `http://localhost:3000`,
  the client dev origin; set to the deployed web origin in prod). Distinct from `PUBLIC_API_URL`.
- In `forgot-password`, build `const resetUrl = \`${env.APP_URL}/reset-password?token=${token}\``
  and put it in the email (subject + a short body with the link + an expiry note). Keep NL/EN-ish
  copy simple; email templating is out of scope (plain text link is fine).
- No change to `reset-password` — it already takes `{ token, newPassword }`.

### 2b. (Optional, nice) expiry surfaced
The token already has `expiresAt`. Mention "this link expires in N hours" in the email text using
the known TTL. No new logic.

That's the entire backend delta — the endpoints, token model, session revocation are all done.

---

## 3. Client — API

`lib/api/auth.ts` (both unauthenticated, `{ auth: false }`):
```ts
export function forgotPassword(email: string): Promise<void>        // POST /auth/forgot-password → 204
export function resetPassword(token: string, newPassword: string): Promise<void> // POST /auth/reset-password → 204
```

---

## 4. Client — pages + routing

Two new **public** routes (siblings of `/login`, outside the auth guard) in `app/router.tsx`:
- `/forgot-password` → `<ForgotPassword />`
- `/reset-password` → `<ResetPassword />` (reads `?token=` via `useSearchParams`)

New feature files under `features/auth/`:

### 4a. `ForgotPassword.tsx` (+ reuse the auth split-screen shell if there is one)
- Single email field + "Send reset link" button.
- On submit → `forgotPassword(email)`. Because the API always returns 204 (no enumeration), show a
  **generic success state regardless**: "If an account exists for that email, we've sent a reset
  link. Check your inbox." + a "Back to login" link. Never reveal whether the email existed.
- Loading + error (network only) states.

### 4b. `ResetPassword.tsx`
- Reads `token` from the URL. If missing → show an "invalid link" state with a link to
  `/forgot-password`.
- New password + confirm fields (min 8, match — same rules as change-password).
- On submit → `resetPassword(token, newPassword)`:
  - Success → success state ("Your password has been reset") + a **"Go to login"** button.
    (All sessions were revoked server-side; user logs in fresh with the new password.)
  - 400 (invalid/expired token) → inline error ("This reset link is invalid or has expired") +
    a link to request a new one.
- Reuse the password-field validation pattern from `ChangePasswordForm`.

### 4c. Wire the login link (#4)
In `LoginForm.tsx`, change the dead `href="#"` "Forgot password?" `<Link>` to navigate to
`/forgot-password` (`component={RouterLink} to="/forgot-password"` or `onClick → navigate`).

**Layout:** reuse whatever shell `Login` uses (the split-screen brand/form). If `Login.tsx`
composes `<LoginForm/>` inside a shared layout, factor the layout so the two new pages sit in the
same frame for visual consistency. Keep it simple — a thin wrapper is fine.

---

## 5. i18n (NL + EN)

New `auth.forgot.*` and `auth.reset.*` keys: titles, subtitles, email label, send button, the
generic "check your inbox" message, new/confirm password labels, success messages, error messages
(invalid link, expired, passwords don't match, too short), back-to-login / go-to-login links.
English keys, Dutch + English values.

---

## 6. Verification (curl + tests, no browser)

Dev email is the console stub, so the token is readable from the server log (or the DB) for e2e.

- **curl the full flow** with a throwaway user:
  1. `POST /forgot-password { email }` → 204. Grab the token (from the server console line, or
     query `PasswordReset` in the DB by userId — simplest for the script).
  2. `POST /reset-password { token, newPassword }` → 204.
  3. Login with the NEW password → success; OLD password → 401.
  4. Reuse the SAME token → 400 (single-use consumed).
  5. `forgot-password` for a **non-existent** email → still 204 (no enumeration).
  6. `reset-password` with a garbage token → 400.
  7. (If practical) expired-token path → 400. (Token TTL may be long; can assert via a
     manually-expired row in the integration test.)
- **Integration test:** forgot → read token from DB → reset → login-with-new; plus reused-token
  and bad-token → 400.
- `tsc` (backend/client) + `vite build` + full `vitest` green.
- Do NOT reset any seeded demo account's password. Throwaway user only; clean up after.

---

## 7. Build order

1. Backend: `APP_URL` in env + email a reset LINK (forgot-password). curl the endpoints.
2. Client API: `forgotPassword` / `resetPassword`.
3. Routing: add `/forgot-password` + `/reset-password` public routes.
4. `ForgotPassword.tsx` (request + generic success).
5. `ResetPassword.tsx` (token from URL → new password → success/expired).
6. Wire the login "Forgot password?" link (#4).
7. i18n NL + EN.
8. Verify (§6): curl flow + integration test + tsc/build. Clean up.

---

## 8. Dependency + follow-up notes (explicit)

- **Blocks prod usability on #11 (real email).** The flow is dev-complete now; in production it
  throws at `sendEmail` until a provider (Postmark/SES/Resend) is wired. This plan makes #11 the
  ONLY remaining thing between this and prod-usable — everything else is done. Note this in
  MISSING.md when ticking #10/#4.
- After #11 lands, no password-flow code changes are needed — just config the provider.

---

## 9. Open questions (defaulted)

1. **Reset link base URL:** default `APP_URL` env, `http://localhost:3000` in dev. In prod set to
   the deployed web origin. (Alternative: derive from the request Origin header — less reliable
   behind proxies; not chosen.)
2. **Enumeration safety:** keep the always-204 forgot response + generic client success. Do NOT
   tell the user whether the email existed. (Already the backend behaviour.)
3. **Reset link expiry copy:** show the TTL in the email text if it's readily available; otherwise
   a generic "expires soon". Minor.
4. **Page shell:** reuse the login split-screen layout for visual consistency; factor a thin
   shared wrapper if needed.

---

## Out of scope (v1)
- Real email provider wiring (#11 / M3) — this plan depends on it for prod but doesn't build it.
- HTML email templates (plain-text link is fine).
- Rate-limiting beyond the existing `authRateLimit` on forgot-password.
- "Resend link" cooldown UI.
