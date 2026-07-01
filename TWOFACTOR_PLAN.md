# Two-Factor Auth (2FA) — Comprehensive Plan

Expose the fully-built TOTP backend through a real UI: a **Settings → Security** tab to
enable/disable 2FA, **and** the missing **login code-entry step** (without which enabling 2FA
would lock the user out).

---

## 0. What exists today (audited)

**Backend — complete and working:**
- `POST /auth/2fa/setup` (requireAuth) → generates a pending TOTP secret, returns
  `{ secret, otpauthUrl, qrDataUrl }` (`qrDataUrl` is a ready `<img>`-able data URL).
- `POST /auth/2fa/enable` (requireAuth) → `{ code }`; verifies the code against the pending
  secret, promotes it to active (`totpEnabled=true`). Returns **204**.
- `POST /auth/2fa/disable` (requireAuth) → `{ password }`; verifies password, clears
  `totpEnabled`/`totpSecret`. Returns **204**.
- Login flow: `POST /auth/login` returns `{ mfaRequired: true, mfaToken }` when 2FA is on;
  `POST /auth/login/2fa` → `{ mfaToken, code }` completes it. TOTP lib (`otplib`) + QR
  (`buildOtpAuthUrl`, `otpAuthQrDataUrl`) all present.
- `totpEnabled` is already in the AuthUser DTO (backend + client types).
- Schemas exist: `enable2faSchema` ({code}), `disable2faSchema` ({password}), `login2faSchema`.

**Client — the gaps:**
- ⚠️ **CRITICAL: the login 2FA step is a stub.** `LoginForm.tsx:37` — on `mfaRequired` it just
  shows an *error* (`// a code step would go here (later)`). `loginWith2fa()` exists in
  `lib/api/auth.ts` but nothing calls it. **→ Enabling 2FA now would lock the account out on next
  login.** This MUST be built as part of this work.
- **No Security settings tab.** `SectionId = "profile" | "company" | "notifications" |
  "preferences"` — no "security". No UI to call setup/enable/disable.

**Consequence:** the work is two halves — (A) the Security tab to manage 2FA, and (B) the login
code-entry step so 2FA is actually safe to turn on. B is non-optional.

---

## 1. Client API additions (`lib/api/auth.ts` already has `loginWith2fa`)

Add a small `lib/api/twofactor.ts` (or extend auth.ts):
```ts
setup2fa(): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }>  // POST /auth/2fa/setup
enable2fa(code: string): Promise<void>       // POST /auth/2fa/enable  (204)
disable2fa(password: string): Promise<void>  // POST /auth/2fa/disable (204)
```
After enable/disable (both 204), the caller **refetches `/auth/me`** (via `fetchMe` +
`setUser`) so `totpEnabled` updates app-wide.

---

## 2. Settings → Security tab

### 2a. Wire the new section
- `constants.ts`: add `"security"` to `SectionId` and a `SECTIONS` entry
  (icon: `LockOutlinedIcon` or `SecurityIcon`). Available to **all roles** (not adminOnly —
  every user secures their own account).
- `Settings.tsx`: render `<SecurityForm />` when `active === "security"`.
- i18n: `settings.sections.security.{title,subtitle}`.

### 2b. `SecurityForm.tsx` (feature-local component, its own file)
Reads `user.totpEnabled` from auth context. Two states:

**When OFF — enable flow (a small stepper/dialog):**
1. User clicks **"Enable two-factor authentication"**.
2. Call `setup2fa()` → show the **QR code** (`<img src={qrDataUrl}>`) + the secret as text
   (for manual entry into an authenticator app), with a short "scan this with Google
   Authenticator / 1Password / Authy" instruction.
3. User enters the 6-digit code from their app → call `enable2fa(code)`.
   - Success → refetch `/me` (setUser) → tab now shows the ON state + a success toast.
   - Bad code → inline error ("That code didn't match, try again"), stay on the step.
4. Cancel at any point (the pending secret is harmless; a re-setup overwrites it).

**When ON — disable flow:**
- Show "Two-factor authentication is on" with a **Disable** button.
- Disable requires the account **password** (backend enforces it) → a small confirm dialog with
  a password field → `disable2fa(password)` → refetch `/me` → OFF state + toast.
- Wrong password → inline error.

UI: match the app's M3 card language (GroupLabel, fieldGrid, tokens). The QR + code entry can be
a dialog or an inline expanding panel — lean **dialog** for focus (like the other create dialogs).
One component file; extract the enable dialog to `components/TwoFactorSetupDialog.tsx` if it grows.

### 2c. Recovery / lockout note
TOTP has no backend recovery-codes flow (out of scope). Surface a one-line caution: "Keep your
authenticator app safe — you'll need it to sign in." (A real recovery-codes feature is a
follow-up; note it in MISSING.md, don't build now.)

---

## 3. Login code-entry step (the non-optional half)

`LoginForm.tsx` currently dead-ends on `mfaRequired`. Replace the stub:

- On `apiLogin()` returning `{ mfaRequired: true, mfaToken }`, switch the form into a **2FA
  step**: hide email/password, show a single **6-digit code** input + "Verify" button (and a
  "Back to login" link). Keep the `mfaToken` in component state.
- On submit → `loginWith2fa(mfaToken, code)` → on success `setUser(user)` + navigate. On bad code
  → inline error, stay on the step.
- The `mfaToken` is short-lived (backend `signMfaToken`) — if it expires, show an error and send
  the user back to the credentials step.
- i18n: `auth.twoFactor.{title,codeLabel,verify,back,invalidCode,expired}`. Remove the old
  `auth.errors.mfaRequired` dead string.

This makes 2FA a complete, safe round-trip: enable in Settings → sign out → sign in with code.

---

## 4. i18n (NL + EN)

New keys:
- `settings.sections.security.{title,subtitle}`
- `settings.security.*` — enable/disable copy, QR instructions, code label, disable-password
  label, success/error toasts, the "keep your app safe" caution.
- `auth.twoFactor.*` — login step copy.
English keys, Dutch + English values. No Dutch in code.

---

## 5. Verification (no browser — curl + tests)

Backend is already built; the risk is the client round-trip and not locking anyone out. Verify:

- **curl the full lifecycle** with a throwaway user:
  1. `POST /2fa/setup` → get `secret`.
  2. Generate a valid TOTP from the secret (using `otplib` in a tiny node script, same lib the
     server uses) → `POST /2fa/enable {code}` → 204. `GET /me` → `totpEnabled: true`.
  3. `POST /login` (that user) → `{ mfaRequired, mfaToken }`. Generate a fresh code →
     `POST /login/2fa {mfaToken, code}` → returns tokens + user. **Proves the login round-trip.**
  4. Wrong code on enable/login → 400/401. Disable with wrong password → 401; correct → 204;
     `GET /me` → `totpEnabled: false`.
- **Integration test** covering setup→enable→login-with-code→disable (using otplib to mint codes).
- `tsc` (backend/client) + `vite build` + full `vitest` green.
- Clean up the throwaway user + any state. Do NOT enable 2FA on the seeded demo accounts (would
  make manual demo logins need a code) — verify only with a throwaway user.

---

## 6. Build order

1. Client API: `setup2fa` / `enable2fa` / `disable2fa` (+ reuse existing `loginWith2fa`).
2. **Login 2FA step** in `LoginForm.tsx` (do this FIRST so 2FA is never a lockout risk).
3. Security section wiring (`constants.ts` + `Settings.tsx`).
4. `SecurityForm.tsx` + `TwoFactorSetupDialog.tsx` (enable QR/code + disable password).
5. i18n NL + EN (both `settings.security.*` and `auth.twoFactor.*`).
6. Verify (§5): curl lifecycle + integration test + tsc/build. Clean up.

---

## 7. Open questions (defaulted)

1. **Enable UI: dialog vs inline panel** — default **dialog** (`TwoFactorSetupDialog`), matches
   the app's other flows and keeps focus on the QR + code.
2. **Recovery codes** — out of scope for v1 (backend has none). Note as a follow-up in MISSING.md.
   Add the "keep your app safe" caution so users aren't blindsided.
3. **Which roles** — all roles get the Security tab (everyone secures their own login).

---

## Out of scope (v1)
- Recovery / backup codes (needs new backend). → follow-up.
- Remember-this-device / trusted devices.
- SMS or email OTP (this is authenticator-app TOTP only, which is what the backend implements).
- Enforcing 2FA org-wide (admin policy). → follow-up if the client wants it.
