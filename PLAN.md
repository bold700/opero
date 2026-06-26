# Opero — End-to-End Plan (to a deployed, working product)

The honest current state, what's left, and the order to do it in. Written so each
phase is a self-contained chunk of work with a clear "done" definition.

---

## Where we are now (verified)

**Backend (Express + Prisma + Postgres) — ~106 routes, solid.**
- Auth: login, JWT + rotating refresh, 2FA (TOTP), password reset, role guards. ✅
- All domain modules exist: customers (13), employees (7), materials (17), projects (33),
  work-orders (25), planning (6), dashboard (1), invoices (3), reports (1). ✅
- 9 vitest tests pass (auth, role guard, full lifecycle). ✅
- All internals English; demo data seeded (`admin@`/`technician@`/`client@opero.test`, `opero123`). ✅

**Frontend (Vite + React + MUI/M3) — all 9 list/overview screens built + wired.**
- Login, Dashboard, Work orders, Customers, Employees, Materials, Planning, Reports → built
  in M3 AND wired to real API data (loading/error states, role-aware). ✅
- Settings → built (UI only), **NOT wired**. ❌
- Auth: login wired to real API; **no 2FA/forgot-password screens**. ❌

**The big gaps (what makes it not-yet-a-product):**
1. **No detail screens.** 0 `:id` routes. Clicking a work order / customer / project goes
   nowhere. The **work-order detail + the blockage/extra-work → approval → audit flow** —
   the actual core product the client is paying for — does not exist on the frontend.
2. **No real photo/file upload.** Backend has placeholder filename strings; no storage.
   The whole product is photo-driven (pre-job check, blockage reports). ❌
3. **Email is a stub** (`sendEmail` logs to console; throws in prod). Password reset / 2FA
   mails don't actually send. ❌
4. **Settings not wired** + some settings endpoints missing (company/org, notification prefs).
5. **No mobile layout pass.** Desktop-first; the monteur works on a phone on site.
6. **i18n not wired** — Dutch is hardcoded inline (works, but not the planned translation layer).
7. **Not deployed.** Decided stack: Vercel (client) + Hetzner/Docker (API) + Supabase (Postgres).

---

## The plan (phases in execution order)

Each phase: **Goal · Backend work · Frontend work · Done when.**
Verify every phase with `tsc --noEmit` + `vite build` + backend `vitest` + `curl`. No browser tests.

---

### PHASE 1 — Work-order detail + the core approval flow  ★ the heart of the product
> This is what the client actually bought: log a blockage/extra-work on site with a photo,
> route it through office → client approval, with an audit trail. Nothing else matters as much.

**Backend** (mostly exists — verify + fill gaps):
- `GET /work-orders/:id` returns the full nested work order (tasks → materials, photos,
  signature, status) — exists; confirm shape.
- Extra-work (`meerwerk`→`extraWork`) endpoints: create, approve-office, approve-client,
  reject, toggle-done — exist in projects module; confirm + expose what the detail UI needs.
- Task ops (add/edit/complete, start/end timer, set hours), material usage, sign-off
  (`/finish`) — exist; confirm.
- Activity log per project (`GET /projects/:id/activity`) — exists; this IS the audit trail.

**Frontend** (new — biggest build):
- Route `/work-orders/:id` → a **WorkOrderDetail** feature.
- Header: number, customer, status, "open project" link, the work-order actions.
- **Tasks list** (zones): each task with its materials, photos (before/result), done state,
  start/stop timer, hours. Monteur edits these; **no prices shown to technician role**.
- **Extra-work panel**: list of reported extra work, each with status
  (office-approved / client-approved / rejected) + the approval/reject buttons gated by role
  (office=admin, client=client). A "report extra work" form (description + amount + photo).
- **Activity / audit trail** panel: the chronological log.
- **Sign-off**: signature capture → `/finish`.
- Wire the work-orders list "eye" action → navigate to `/work-orders/:id`.

**Done when:** an admin can open a work order, see its tasks; a technician can report extra
work with a reason; admin approves (office), client approves (client) — each step recorded in
the activity log; the work order can be signed off. All against real API data.

---

### PHASE 2 — Pre-job photo check + real file storage
> The other core flow + the thing that unblocks all photo features.

**Backend:**
- Add an **object-storage adapter** (`lib/storage.ts`) — S3-compatible (Supabase Storage or
  any S3). `putObject`, `getSignedUrl`, `deleteObject`.
- Wire the photo/drawing/signature endpoints (already declared in work-orders/projects) to
  accept **multipart upload** (multer), store to the bucket, persist the storage **key**,
  return a **signed URL** in DTOs.
- A **pre-job checklist** on the work order / project (a checklist + required photos before
  dispatch). The model has `DeliveryChecklist`; add/confirm a pre-job equivalent or reuse.

**Frontend:**
- Real `<input type=file>` / camera capture on task photos, drawings, signature pad.
- Pre-job check screen/section: checklist + "add photo before dispatch".
- Render uploaded images from signed URLs; survive reload.

**Done when:** a real photo taken on the detail screen uploads to storage and re-renders after
reload; pre-job check can be completed with photos before a job is marked dispatched.

---

### PHASE 3 — Customer + Project detail screens
> The office side: drill into a customer or a project (the lifecycle container).

**Backend:** `GET /customers/:id` (+ contacts, locations), `GET /projects/:id` (full nested:
intake, quote, work orders, invoice, activity) — exist; confirm DTO shapes feed the UI.

**Frontend:**
- `/customers/:id` — customer detail: info, contacts, locations, their projects/work orders.
- `/projects/:id` — project detail: the lifecycle (intake → quote → work orders → invoice),
  status/stage controls, activity. Wire the quote/invoice actions (send, accept, paid).
- Wire list "view" actions to navigate to these.

**Done when:** clicking a customer or project opens a real detail view with its nested data and
the lifecycle actions work end-to-end.

---

### PHASE 4 — Settings (wire it + missing endpoints)
**Backend (build missing):**
- `GET/PATCH /settings/profile` (current user) — or reuse `/auth/me` + a profile PATCH.
- `GET/PATCH /settings/company` (org details) — **new** (Organization fields).
- `GET/PATCH /settings/notifications` (per-user prefs) — **new** (small prefs table or JSON).
- The **"hide prices from technicians"** toggle Kenny asked for — back it with an org/user
  setting (today it's hardcoded via `canSeePrices(role)`; make it configurable).

**Frontend:** wire the 4 settings tabs (Profiel/Bedrijf/Meldingen/Voorkeuren) to load + save.

**Done when:** editing profile/company/prefs persists and reloads from the API; the hide-prices
toggle actually controls technician price visibility.

---

### PHASE 5 — Auth screens (2FA + forgot/reset) + real email
**Backend:** wire `sendEmail()` to a real provider (**Resend**) — password-reset + 2FA mails
actually send. (Interface already exists; just implement + env `RESEND_API_KEY`.)

**Frontend:**
- `/forgot-password` + `/reset-password` screens (the API exists).
- 2FA: the login MFA step (code input) + enable/disable 2FA in Settings (QR enrollment).

**Done when:** a user can reset their password via email end-to-end, and enable+use 2FA.

---

### PHASE 6 — Mobile / PWA pass
> The monteur uses this on a phone on a roof. Desktop-first won't cut it.

**Frontend:**
- Responsive pass on the core monteur flows (work-order detail, pre-job check, extra-work
  report) — mobile-first, big touch targets.
- The M3 bottom-nav already exists; verify it + the rail collapse.
- **PWA**: manifest + service worker so it installs to home screen (Kenny wants
  "download from store" feel without the store). Vite PWA plugin.

**Done when:** the monteur flows are usable one-handed on a phone, and the app installs to the
home screen.

---

### PHASE 7 — i18n (react-i18next)
**Frontend:** install `react-i18next`, extract the inline Dutch display strings to a `nl`
translation file keyed by the `labelKey`s already scaffolded (nav etc.). English internals stay;
Dutch becomes data. Lets the client get an English version later trivially.

**Done when:** all user-facing Dutch comes from translations, not inline literals.

---

### PHASE 8 — Reports completeness + PDF export
**Backend:** flesh out reports (the module returns aggregates now; add the timesheet view per
employee, material-usage report, and **CSV/PDF export** of a work order — spec "Export PDF").
A server-side PDF renderer for a work order.

**Frontend:** Reports filters + Export button; work-order detail "Export PDF" button.

**Done when:** an admin can export a work order to PDF and pull the report views with date filters.

---

### PHASE 9 — Production hardening + deploy
> Decided stack: **Vercel (client) · Hetzner + Docker (API) · Supabase (Postgres)**.

**Infra/config:**
- Pin **Node 22** (`.nvmrc` + `engines`).
- **Dockerfile + docker-compose** for the API; **Caddyfile** (HTTPS reverse proxy on an `api.`
  subdomain, Let's Encrypt); **vercel.json** for the client (SPA fallback + build).
- Env: `DATABASE_URL` (Supabase, pooled URL + `DIRECT_URL` for migrations), `JWT_SECRET`,
  `CORS_ORIGIN` (the Vercel domain), `RESEND_API_KEY`, storage creds, `VITE_API_URL`.
- Migrations run on deploy (`prisma migrate deploy`); seed only an initial admin (not demo data)
  for production.

**Hardening pass:**
- CORS allowlist = the real web origin only; HTTPS-only cookies; rate limits on auth (Redis or
  accept in-memory for single instance); body-size limits; audit-log on all mutations (exists);
  confirm no price leakage to technician, no cross-customer leakage to client.
- Postgres automated backups (Supabase handles this).
- A `ci.yml`: typecheck + lint + tests + build on every push.

**Done when:** a fresh deploy from scratch (provision DB → migrate → create admin → deploy API
→ deploy web) yields a working production app over HTTPS on the client's domain, and CI gates merges.

---

## Cross-cutting rules (every phase)
- **Figma is the spec.** If a screen needs a field the backend lacks, extend the backend
  (migration + seed) — don't fake it or dumb down the design.
- **English internals, Dutch display-only.** No Dutch identifiers; Dutch text is data.
- **One component per file**, feature folders, shared design tokens — no magic numbers.
- **Technician never sees prices** (`canSeePrices`); **client only sees their own data**.
- **Every mutation** is transactional + writes the audit log.
- Verify with typecheck/build/tests/curl. **Never Playwright / browser tests.**
- **No auto-commit**; no Claude signature on commits.

---

## Suggested grouping by milestone (if you want to ship incrementally)

- **Milestone A — "It does the core job"**: Phases 1 + 2 + 3 (detail screens, photos, approval
  flow, project/customer drill-in). This is the demo that proves the product.
- **Milestone B — "It's a real account product"**: Phases 4 + 5 (settings, auth screens, email).
- **Milestone C — "It's field-ready"**: Phase 6 (mobile/PWA).
- **Milestone D — "It's polished + live"**: Phases 7 + 8 + 9 (i18n, reports/PDF, deploy).

Recommend doing **A** next — it's the part with actual product value and the biggest current gap.
