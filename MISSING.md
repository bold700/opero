# Opero — Outstanding Work

A verified, code-grounded list of everything still missing or non-functional.
Tick items as they land. Grouped by type, then ranked by effort/value at the end.

Status legend: ⬜ todo · 🔄 doing · ✅ done

---

## 🔴 Dead UI — looks functional, does nothing

Buttons/links that render but have no handler or no backend behind them.

- [x] **1. Dashboard search** 🔍 — ✅ DONE. Inline search field in the top bar
  (`SearchField.tsx`) + real role-scoped `GET /api/search?q=` across customers/projects/work
  orders. Verified end-to-end (admin/technician/client scoping, cross-org isolation).

- [x] **2. Dashboard bell / notifications** 🔔 — ✅ DONE. Derived action feed
  (`GET /api/notifications`): extra work awaiting approval, urgent/blocked projects, newly
  assigned work orders — role-scoped + gated by the notification-preference toggles (which now
  actually do something). Unread badge via a `User.notificationsSeenAt` marker; opening the bell
  marks seen. Dropdown with per-item navigation. Verified (role/pref/seen/cross-org) + integration
  test.

- [x] **3. Dashboard avatar** — ✅ DONE. Now a clickable button → navigates to Settings
  (with a tooltip). Still shows the uploaded photo / initials.

- [x] **4. "Forgot password?" link** — ✅ DONE. Now routes to `/forgot-password` (built in #10).

- [x] **5. Reports "Export" button** — ✅ DONE. Exports the current report figures (KPIs, weekly
  chart, top technicians) to a CSV download. Disabled until data loads.

- [ ] **6. Work-order "Export PDF" button** — `client/src/features/work-order-detail/components/DetailHeader.tsx:80`
  `disabled` placeholder. Real fix = server-side PDF generation (its own chunk of work).
  *Fix now:* leave disabled / hide until M3, or build the PDF renderer.

---

## 🟡 Bugs / mismatches

- [x] **7. Reports nav vs permission mismatch** — ✅ DONE. Nav now `roles: ["admin"]`, matching
  the admin-only API. Technicians no longer see a Reports item that 403s.

---

## 🟠 Backend exists, no UI to use it

Finished server features that nobody can reach from the app.

- [x] **8. Two-factor auth (2FA)** — ✅ DONE. New Settings → Security tab: enable via QR + code
  confirmation, disable via password. Refetches /me so `totpEnabled` updates app-wide. ALSO built
  the previously-stub **login code-entry step** (without it, enabling 2FA would have locked users
  out). Full lifecycle verified end-to-end (setup→enable→login-with-code→disable) + integration
  test. No seed account has 2FA on. Follow-up: recovery/backup codes (backend has none).

- [x] **9. Change password (in-app)** — ✅ DONE. `POST /auth/change-password` (verify current →
  set new → revoke all sessions but re-issue the current one, so no self-logout) + a Change
  password group in the Security tab (current/new/confirm, inline validation). Verified end-to-end
  (wrong current 401, too-short/same 400, success re-issues session + old token revoked) +
  integration test. Seed passwords untouched.

- [x] **10. Password reset page** — ✅ DONE (dev-complete). Built `/forgot-password` (email → generic
  no-enumeration success) + `/reset-password?token=` (new password → success/expired), wired the
  login link, and changed the email to send a reset LINK (`APP_URL/reset-password?token=`).
  Verified end-to-end (reset works, old pw fails, reused/bad token 400, unknown email still 204).
  ⚠️ **Prod delivery blocked on #11 (real email)** — works now via the dev console log; the instant
  a provider is wired, it delivers for real with no further code changes.

---

## ⚪ M3 — Live (the remaining paid milestone, €400)

- [ ] **11. Real email sending** — `backend/src/lib/email.ts`
  `sendEmail()` is a console stub (`TODO(prod): wire Postmark/SES/Resend`). Auth flows depend
  only on this one function. Needed for password reset (#10). *(2FA uses TOTP, not email.)*

- [ ] **12. Deploy — confirm live** — `railway.json` exists (Nixpacks build, migrate-on-deploy,
  healthcheck) but it's **not confirmed running** on a real URL. Client (Vite) deploy target not
  set up. Supabase prod DB + storage env wiring to verify.

- [ ] **13. Mobile pass** — some responsive `sx` exists, but no dedicated mobile sweep of the
  **monteur on-site flow** (work-order detail, photos, sign-off) — the one that matters most on a
  phone.

- [ ] **14. Hardening + runbook** — deploy runbook, prod secrets/rotation, error monitoring, etc.

---

## 🔑 Carry-over (do soon, low effort)

- [ ] **15. Rotate Supabase keys** — keys were pasted into chat; treat as compromised. Rotate in
  Supabase → Project Settings → Storage → S3 access keys. (Only live in `backend/.env`, gitignored.)

- [x] **16. Rename seed org** — ✅ N/A. The live org is already "Test company DV"; seed default is
  "Opero Demo". No longer an issue.

---

## ✅ Already done (for reference — don't redo)

- M1: core product (DB, login, 3 roles, full work-order + approval + sign-off flow, activity/audit)
- M2: Customers / Employees / Materials / Planning CRUD; Settings (profile, company,
  notifications, language, hide-prices toggle)
- M2 Photos & signature: real upload on all 6 surfaces, drawn signature, pre-job dispatch gate,
  Supabase storage, upload hardening
- Quick-create "+" menu (FAB → role-filtered create menu, all 5 entities)
- Profile photo upload (avatar end-to-end on Supabase, shown app-wide)
- Work-orders table: eye → chevron action icon

---

## Suggested order to work through

**Batch A — quick wins (no new backend, ~an afternoon):**
- #7 Reports nav fix (1 line)
- #3 dashboard avatar → open profile menu
- #5 Reports Export → CSV or remove
- #16 rename seed org · #15 rotate keys

**Batch B — cheap real features:**
- #1 search → scoped client "jump to"
- #2 bell → derived action feed

**Batch C — Security (one settings tab + two auth pages):**
- #8 2FA UI (backend done) → #9 change password → #10 + #4 forgot/reset pages

**Batch D — M3 ship it (€400 milestone):**
- #11 email → #12 deploy → #13 mobile → #14 hardening
- (#6 Export PDF and #2/#1 heavyweight versions slot in here if wanted)
