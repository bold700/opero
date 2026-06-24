# Opero — How It Works (Current State)

A B2B insulation work-order platform. This doc explains what exists **today** and how a
request flows end-to-end. (Roadmap for what's not built yet is at the bottom.)

> **Status:** backend is feature-complete (auth + all domain modules). The web app still
> runs on its old localStorage store — **not yet wired to the API** (that's Phase 5).

---

## 1. The big picture

```
┌─────────────────────────────┐         ┌──────────────────────────────┐         ┌──────────────┐
│  client/  (Next.js 16)      │  HTTP   │  backend/  (Express + Prisma) │  SQL    │  Postgres    │
│  React 19 + Tailwind + UI   │ ──────► │  /api/* — auth + 8 modules    │ ──────► │  (Docker)    │
│  Zustand store (UI state)   │  JSON   │  JWT auth, role guards, audit │         │  32 tables   │
└─────────────────────────────┘         └──────────────────────────────┘         └──────────────┘
                  │                                      │
                  └──────────────┬───────────────────────┘
                                 ▼
                        shared/  (@opero/shared)
              types · zod schemas · domain logic · permissions
                  (imported by BOTH client and backend)
```

It's a **pnpm monorepo** with three workspaces:

| Folder | Package | What it is |
|---|---|---|
| `client/` | `@opero/client` | The existing Next.js web app (UI). |
| `backend/` | `@opero/backend` | Express REST API + Prisma + Postgres. |
| `shared/` | `@opero/shared` | Framework-free types, zod schemas, domain functions, the permission matrix. No React, no DB. Both apps import it. |

**Stack:** Next.js 16 / React 19 / Tailwind v4 / shadcn-ui (client) · Express 4 / Prisma 6 / Postgres 16 (backend) · TypeScript everywhere · own auth (bcrypt + JWT + otplib TOTP). All standard, no exotic libs.

---

## 2. The domain (what the app models)

The central entity is a **Project** — the lifecycle container for an insulation job. A project
moves through stages and statuses and carries everything nested under it.

**Status** (coarse, 3): `verkoop` (sales) → `operatie` (operations) → `afronding` (closing).
**Stage** (finer, 4): `concept` → `in_progress` → `ready` → `done`.

A Project owns: an **Intake** (site survey), a **Quote** (+ line items), **Werkbonnen** (work
orders) → **tasks** → **materials** (the shared line-item that feeds quote *and* invoice),
**Meerwerk** (extra work), **Oplevering** (delivery sign-off), **Planning items**, an
**Invoice**, **Material requirements**, and an **Activity log**.

**32 Postgres tables** total (see `backend/prisma/schema.prisma`), including org/tenant,
users, auth sessions, and an audit log.

### Roles (3, per the spec)
| Role | Sees / can do |
|---|---|
| **Admin** | Everything — full CRUD on all modules, all KPIs, invoices. |
| **Monteur** (field tech) | Only projects they're assigned to; edits work orders (tasks, photos, materials, signature); **never sees prices**; own schedule + timesheet. |
| **Klant** (customer) | Only their own company's projects; view status, accept own quote, manage own profile. |

Permissions are encoded once in `shared/src/permissions.ts` (`PERMISSION_MATRIX`) and read by
both the API (guards) and — eventually — the web nav.

---

## 3. How a request flows (end-to-end)

### 3a. Logging in
```
POST /api/auth/login  { email, password }
        │
        ├─ Express: helmet → cors → json → pino log → rate-limit
        ├─ zod-validate body (shared loginSchema)
        ├─ Prisma: find user by email
        ├─ bcrypt.compare(password, passwordHash)
        │
        ├─ if 2FA off → { accessToken (JWT, 15m), refreshToken, user }
        └─ if 2FA on  → { mfaRequired: true, mfaToken }
                            → POST /api/auth/login/2fa { mfaToken, code }
                              → verify TOTP → tokens
```
- **Access token**: JWT, 15-min, carries `{ userId, role, orgId }`.
- **Refresh token**: opaque, stored only as a SHA-256 hash, **single-use rotation** (using a
  consumed one fails). `POST /api/auth/refresh` swaps it for a new pair.
- Also: `forgot-password` / `reset-password` (hashed 1h tokens, revokes sessions), `2fa/setup`
  (returns a QR), `2fa/enable`, `2fa/disable`, `logout`, `me`.

### 3b. A guarded domain request
```
GET /api/projects     (Authorization: Bearer <accessToken>)
        │
        ├─ requireAuth   → verify JWT → load user → attach req.user
        ├─ (route guard) → e.g. requireRole("admin") or ownership check
        ├─ visibility    → admin: all · monteur: assigned · klant: own customer
        ├─ Prisma query  → org-scoped + visibility-scoped
        ├─ DTO mapping   → strip internal columns; strip PRICES if monteur
        └─ JSON response
```

### 3c. A mutation (write)
```
POST /api/customers   { name, ... }
        │
        ├─ requireAuth + requireRole("admin")
        ├─ zod-validate + clampText/clampNumber (input limits)
        ├─ prisma.$transaction:
        │     ├─ create/update the row
        │     └─ audit_log row (who did what, diff)         ← every mutation
        │        (+ project_activity row for project changes)
        └─ 201/200 with DTO
```
Every write is transactional and audited. Errors are serialized centrally to
`{ error: { code, message } }` (zod errors → 400, HttpError → its status, else 500).

---

## 4. The full lifecycle (the happy path)

This is the end-to-end flow the e2e test exercises:

```
1. Admin creates a CUSTOMER                 POST /api/customers
2. Admin creates a PROJECT (→ OP-2026-NNN)  POST /api/projects
3. Complete the INTAKE                       POST /api/projects/:id/intake/complete
4. Build the QUOTE (line items)              POST /api/projects/:id/quote/lines
5. Send + accept the quote                   POST .../quote/send · .../quote/accept
       (project moves verkoop → operatie)
6. Create a WERKBON (work order)             POST /api/work-orders {projectId}
7. Add tasks + materials                     POST /api/work-orders/:id/tasks · .../materials
8. Monteur executes: start/end, photos,      POST .../tasks/:id/start|end, /photos, /usage
   usage, then FINISH with signature         POST /api/work-orders/:id/finish {signature}
       (project → afronding / done)
9. Create INVOICE draft → send → paid        POST /api/projects/:id/invoice/draft|send|paid
```

The same werkbon **material rows** drive three views: the **quote** (quantity × price), the
**work order** (what's on site), and the **invoice** (actual usage × price) — one source of truth.

---

## 5. What exists in the backend (115 routes, 8 modules + auth)

| Module | Routes | Covers |
|---|---:|---|
| **auth** | 10 | login, 2FA, refresh, reset, me, logout |
| **customers** | 13 | CRUD + contact persons + locations |
| **employees** | 7 | CRUD, role toggle, timesheet |
| **materials** | 17 | materials, inventory, articles (catalog), werksoorten, orders |
| **projects** | 33 | the lifecycle core — status/stage, intake, quote, meerwerk, oplevering, activity |
| **work-orders** | 25 | werkbonnen: tasks, timing, photos, materials, finish |
| **planning** | 6 | calendar feed, scheduling, route, mark-planned |
| **dashboard** | 1 | role-aware KPIs / tasks / status |
| **invoices** | 3 | draft, send, paid |

Cross-cutting on every route: **auth → role/ownership guard → org scope → zod validate → (write:
transaction + audit) → DTO**. Full mapping in `backend/ROUTE_MAP.md`.

**Tests:** 9 vitest integration tests (auth lifecycle, role guards, full project lifecycle e2e)
— all passing.

---

## 6. Where the data lives

- **Postgres** in a Docker container `opero-postgres` (currently host port **5433**).
- **Prisma** owns the schema (`backend/prisma/schema.prisma`, 32 models) and migrations.
- **Seed** (`backend/src/db/seed.ts`) rebuilds a demo dataset from `@opero/shared` mock data:
  12 projects, 12 customers, 24 employees, materials/inventory/catalog, and **3 demo users**:

  | Email | Password | Role |
  |---|---|---|
  | `admin@opero.test` | `opero123` | admin |
  | `monteur@opero.test` | `opero123` | monteur |
  | `klant@opero.test` | `opero123` | klant |

---

## 7. How to run it (today)

```bash
# 0. Postgres (once)
docker start opero-postgres        # or: docker run ... -p 5433:5432 postgres:16

# 1. Install
pnpm install

# 2. DB: migrate + seed   (run from repo root)
pnpm db:migrate
pnpm db:seed

# 3. Run
pnpm dev:backend     # API on http://localhost:8787  (/healthz, /api/*)
pnpm dev:client      # web on http://localhost:3000   (still localStorage-backed)

# Typecheck / test everything
pnpm -r typecheck
pnpm --filter @opero/backend test
```

Quick API check:
```bash
curl -s localhost:8787/healthz
curl -s -X POST localhost:8787/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@opero.test","password":"opero123"}'
```

---

## 8. What's NOT wired yet (the roadmap)

The backend is done; the rest connects it and fills gaps:

- **Phase 5** — swap the web app's data layer from **localStorage → the API** (TanStack Query).
  *Until this lands, the UI and the API are not connected.*
- **Phase 6** — collapse the web's old 7 roles → the 3 spec roles in nav/UI.
- **Phase 7** — real **file storage** for photos/drawings/signatures/PDFs (currently placeholder
  filenames).
- **Phase 8** — frontend **auth screens** (login / 2FA / forgot-reset) + route protection.
- **Phase 9** — **Reports** and **Settings** sections (don't exist yet).
- **Phase 10** — work-order **PDF export**.
- **Phase 11** — deployment (drop the GitHub Pages static export; deploy API + web for real),
  CI/CD, hardening.

Full detail per phase is in `PLAN.md`.

---

## 9. Key files to know

| Path | What |
|---|---|
| `PLAN.md` | The full phased implementation plan. |
| `DOMAIN_MODEL.md` | The business domain in prose. |
| `backend/prisma/schema.prisma` | The database (32 models). |
| `backend/src/index.ts` | Express app — middleware + all route mounts. |
| `backend/src/auth/` | Auth module (JWT, refresh, 2FA, guards). |
| `backend/src/modules/*/` | One folder per domain module (routes, dto, schema). |
| `backend/ROUTE_MAP.md` | Every endpoint ↔ store action. |
| `shared/src/` | Types, schemas, domain logic, `permissions.ts`. |
| `client/src/` | The Next.js web app. |
```
