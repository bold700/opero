# Opero — Outstanding Work

A verified, code-grounded list of everything still missing or non-functional.
Tick items as they land. Grouped by type, then ranked by effort/value at the end.

Status legend: ⬜ todo · 🔄 doing · ✅ done

---

## 🔴 Dead UI — looks functional, does nothing

Buttons/links that render but have no handler or no backend behind them.

- [ ] **1. Dashboard search** 🔍 — `client/src/features/dashboard/components/DashboardActions.tsx`
  No `onClick`; no search endpoint exists.
  *Fix options:* (a) scoped client-side "jump to" over loaded entities (no backend), or
  (b) real `GET /search?q=` across customers/work-orders/projects (org-scoped, role-filtered).
  Or remove the icon if search isn't wanted yet.

- [ ] **2. Dashboard bell / notifications** 🔔 — `DashboardActions.tsx`
  No `onClick`; `Badge badgeContent={0}` hardcoded; no notifications backend (only the
  per-user *toggle preferences* exist, not a feed).
  *Fix options:* (a) derive a lightweight action feed from existing data ("3 items awaiting
  approval", "2 urgent on site") — no new table, or (b) real `Notification` table +
  `GET /notifications` + mark-read + unread badge.

- [ ] **3. Dashboard avatar** — `DashboardActions.tsx`
  No `onClick`. Now shows the uploaded photo, but clicking does nothing.
  *Fix:* open the same profile menu the nav rail uses (settings/logout), or remove (the rail
  already has a working one).

- [ ] **4. "Forgot password?" link** — `client/src/features/auth/components/LoginForm.tsx:117`
  `href="#"` — goes nowhere. No reset page exists (see #10).

- [ ] **5. Reports "Export" button** — `client/src/features/reports/components/ReportsActions.tsx`
  No `onClick`.
  *Fix:* wire CSV export (small), or remove until scoped. PDF would be heavier.

- [ ] **6. Work-order "Export PDF" button** — `client/src/features/work-order-detail/components/DetailHeader.tsx:80`
  `disabled` placeholder. Real fix = server-side PDF generation (its own chunk of work).
  *Fix now:* leave disabled / hide until M3, or build the PDF renderer.

---

## 🟡 Bugs / mismatches

- [ ] **7. Reports nav vs permission mismatch** — `client/src/app/navigation.ts:33`
  Nav shows Reports to `["admin","technician"]`, but the API (`backend/src/modules/reports/routes.ts`)
  is **admin-only** → a technician clicks in and gets 403 / empty state.
  *Fix:* change nav `roles` to `["admin"]` (one line), OR serve a technician-scoped report view.

---

## 🟠 Backend exists, no UI to use it

Finished server features that nobody can reach from the app.

- [ ] **8. Two-factor auth (2FA)** — backend complete, zero UI
  Endpoints: `POST /auth/2fa/setup`, `/2fa/enable`, `/2fa/disable` + the TOTP login flow all
  work. There is **no Settings UI** to enable it, and **no "Security" tab** at all.
  *Fix:* a Security settings section: show QR (`/2fa/setup` returns `qrDataUrl`), confirm with a
  code (`/2fa/enable`), and a disable flow (`/2fa/disable`, needs password). Cheapest of the
  three security items since the backend is done.

- [ ] **9. Change password (in-app)** — no backend endpoint AND no UI
  A logged-in user can't change their password. Only the email-reset flow exists.
  *Fix:* add `POST /auth/change-password` (verify current → set new) + a form in the Security tab.

- [ ] **10. Password reset page** — backend works, no client page
  `POST /auth/forgot-password` + `/reset-password` work, but there's no page to (a) enter your
  email to request a reset, or (b) use the emailed token to set a new password.
  *Fix:* a `/forgot-password` page (email input) + a `/reset-password?token=` page. Wire #4's link.
  *Note:* depends on real email (#11) to actually deliver the token in production.

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

- [ ] **16. Rename seed org** — currently "Mega Gay Company" in the seed; rename to something
  neutral before any client demo. (`backend/src/db/seed.ts`)

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
