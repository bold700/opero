# Opero — Screens, UI/UX, Flow & Data-Coupling Plan

The complete map of **every screen**, **every button/action**, what it should do, the
backend endpoint/data behind it, whether it's wired today, and how each screen is **coupled
to data from other screens**.

This is the source-of-truth audit for the whole app. It's built from the actual code — every
element below was checked against the real component + its backend module. Use it to know, at
a glance, what's clickable-and-works, what's dead, and what's still to build.

**Legend (wiring state):**
| Mark | Meaning |
|---|---|
| ✅ | Wired — works against the real API / does what it should |
| ⚠️ | Partial — element exists and is half-wired (e.g. state saved but unused, or a known bug) |
| ❌ | Dead — element renders but has **no handler** (clicking does nothing) |
| 🚫 | Not built — the UI element doesn't exist yet (backend may or may not) |

**Roles:** `admin` (office, full), `technician` (monteur, limited, **never sees prices**),
`client` (klant, view + approve own).

---

## Screen inventory & at-a-glance health

| # | Screen | Route | Roles | Data state | Action state |
|---|---|---|---|---|---|
| 1 | Login | `/login` | all (pre-auth) | ✅ wired | ⚠️ forgot-pw + 2FA dead |
| 2 | Dashboard | `/` | all (3 distinct views) | ✅ wired | ❌ nothing is clickable-through |
| 3 | Work Orders (list) | `/work-orders` | admin, technician | ✅ wired | ❌ create/search/view all dead |
| 4 | Work Order (detail) | `/work-orders/:id` | admin, technician | 🚫 **route doesn't exist** | 🚫 entire screen missing |
| 5 | Customers | `/customers` | admin, client | ✅ wired | ❌ create/search/view dead |
| 6 | Employees | `/employees` | admin | ✅ wired | ❌ create/search/menu dead |
| 7 | Materials | `/materials` | admin, technician (read) | ✅ wired | ❌ create/search/view dead |
| 8 | Planning | `/planning` | admin, technician (read) | ✅ wired (+2 bugs) | ❌ nav/create/edit all dead |
| 9 | Reports | `/reports` | admin, technician | ✅ wired | ❌ export dead; rows no nav |
| 10 | Settings | `/settings` | all | 🚫 **persists nothing** | ❌ every field/button dead |

**The headline:** the **read layer is done** — every list/overview screen loads real,
role-aware data from the API. The **write/navigation layer is almost entirely missing** — you
cannot create a work order, open any detail screen, save a setting, or move the planning
calendar. And the **single most important screen — the work-order detail with the
extra-work → approval → audit flow (the core product) — has no route and no page at all.**

---

## Cross-screen data coupling map

Who produces data, who consumes it, and what breaks without it.

```
                    ┌─────────────┐
                    │  CUSTOMERS  │  (producer, root of the chain)
                    └──────┬──────┘
                           │ HARD: a project must belong to a customer
                           ▼
                    ┌─────────────┐
                    │  PROJECTS   │  (the lifecycle container — no list screen of its own yet)
                    └──────┬──────┘
                           │ HARD: a work order must belong to a project
                           ▼
   ┌─────────────┐  ┌─────────────┐         ┌─────────────┐
   │  EMPLOYEES  │─▶│ WORK ORDERS │◀────────│  MATERIALS  │
   │ (producer:  │  │  + DETAIL   │  soft:  │ (producer:  │
   │  technician │  │ (the core)  │ free-   │  catalog,   │
   │  roster)    │  │             │ text    │  reference) │
   └─────┬───────┘  └──────┬──────┘ matl    └─────────────┘
         │ soft            │
         │ (assignment)    │ produces execution data (tasks, hours, extra work, status)
         ▼                 ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │  PLANNING   │  │ DASHBOARD   │  │   REPORTS   │
   │ (consumer:  │  │ (consumer:  │  │ (consumer:  │
   │  projects + │  │  aggregates │  │  aggregates │
   │  technician)│  │  everything)│  │  everything)│
   └─────────────┘  └─────────────┘  └─────────────┘

   SETTINGS ──(would produce)──▶ canSeePrices config consumed app-wide
            (currently dead — toggle persists nothing)
```

**HARD dependencies (the chain breaks without them):**
- Work Order → Project → Customer. You cannot create a work order without a project, and you
  cannot create a project without a customer. **This is why "Nieuwe werkbon" is not one click** —
  it must let the user pick (or create) a customer + project first.
- Planning ↔ Projects: planning reads scheduled projects and *writes back* `plannedDate` +
  project status (`sales → operations` on schedule). Bidirectional.

**SOFT dependencies (degrade, don't break):**
- Work Orders / Planning ← Employees: the technician name/assignment. If an employee is renamed,
  existing rows show stale data (no back-sync).
- Work Orders ← Materials: work-order material lines are **free-text**, so the catalog is a
  reference, not a binding. Materials screen is otherwise independent.

**Pure consumers (read-only, never write back):**
- Dashboard, Reports — both aggregate work orders / projects / employees / invoices / hours.
  They display; they don't (yet) link through to the things they aggregate.

---
---

# 1. Login (`/login`)

**Files:** `client/src/features/auth/Login.tsx`, `components/LoginForm.tsx`,
`components/BrandPanel.tsx`, `client/src/lib/api/auth.ts`, `lib/api/client.ts`,
`backend/src/auth/routes.ts`

**Purpose:** Email/password authentication (with optional 2FA) — the entry point; role is
revealed only after a successful login.

**Role visibility:** all unauthenticated users see the same screen.

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| Brand panel (logo + wordmark) | Static branding | — | ✅ static |
| Email field | Capture email | `POST /auth/login` | ✅ |
| Email clear (✕) | Clear field | local state | ✅ |
| Password field | Capture password | `POST /auth/login` | ✅ |
| Password clear (✕) | Clear field | local state | ✅ |
| "Remember me" checkbox | Persist login preference | local state — **stored but never used** | ⚠️ |
| "Forgot password?" link | Go to reset flow | — (`href="#"`) | ❌ dead |
| "Login" button | Submit credentials | `POST /auth/login` | ✅ |
| Error alert | Show 401 / network error | — | ✅ |
| Loading ("Bezig…") | Disable inputs while submitting | local state | ✅ |
| **2FA code step** | Enter TOTP when `mfaRequired` | `POST /auth/login/2fa` (backend exists) | 🚫 not built (shows an error string instead) |

### Data coupling
- **→ Dashboard (HARD):** the only success path is `navigate("/")`. The `user` object from the
  response is stored in AuthContext and consumed everywhere (role, name).
- **2FA dead-end:** backend returns `mfaRequired:true`; frontend just shows
  "2FA is vereist… (nog niet ondersteund)" — no code-entry UI.

### State summary
Email/password login fully works incl. error handling. Dead/missing: forgot-password link,
the 2FA code step (backend ready, UI absent), and "remember me" has no effect.

---

# 2. Dashboard (`/`)

**Files:** `client/src/features/dashboard/Dashboard.tsx`, `api.ts`, `constants.ts`,
`components/{KpiCard,AdminView,TechnicianView,ClientView,DashboardActions}.tsx`,
`backend/src/modules/dashboard/routes.ts`

**Purpose:** Role-aware home screen — three completely different views off one `GET /dashboard`.

**Role visibility:** all three, distinct views:
- **admin:** KPIs (totals, planned-this-week, urgent/blocked, ready-to-invoice), projects-by-status, pipeline value, open invoices, 7-day activity.
- **technician:** assigned projects, open tasks, today's schedule.
- **client:** only their own customer's projects with status + next step.

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| "Welkom, {firstName}" | Greeting | AuthContext `user.name` | ✅ |
| Admin: 4 KPI cards (totaal / ingepland / spoed+geblokkeerd / facturatie) | Show counts | `GET /dashboard` → kpis | ✅ |
| Admin: "Projecten per status" rows | Show counts by pipeline stage | `GET /dashboard` → byStatus | ✅ (display) |
| Admin: status rows — **click to filter/drill** | Navigate to filtered list | — | ❌ dead |
| Admin: pipeline value / open invoices / activity | Show figures | `GET /dashboard` | ✅ |
| Technician: 3 KPI cards (toegewezen / open taken / vandaag) | Show counts | `GET /dashboard` | ✅ |
| Technician: "Vandaag" project rows | List today's jobs | `GET /dashboard` → todayProjects | ✅ (display) |
| Technician: today row chevron — **click through** | Open the project / work order | — | ❌ dead |
| Technician: empty state | "Geen werkbonnen voor vandaag." | conditional | ✅ |
| Client: "Mijn projecten" rows | List own projects + next step | `GET /dashboard` → projects | ✅ (display) |
| Client: project row — **click through** | Open project detail | — | ❌ dead |
| Client: empty state | "Geen projecten gevonden." | conditional | ✅ |
| Top bar: 🔍 search icon | Open search | — | ❌ dead |
| Top bar: 🔔 notifications | Open notifications (badge=0) | — | ❌ dead |
| Top bar: avatar | Open user menu (profile/logout) | — | ❌ dead |
| Loading / error | Spinner / alert | useApi | ✅ |

### Data coupling (pure consumer — aggregates everything)
- **← Projects (producer):** all three views render project aggregates.
- **← Work Orders:** technician `openTaskCount` comes from work-order tasks.
- **← Invoices:** admin `openInvoices` + `pipelineValue`.
- **← Planning:** admin "ingepland deze week" + technician "vandaag" rely on `plannedDate`.
- **← AuthContext (HARD):** role selects the view; breaks without `user`.

### State summary
Data layer is solid and role-aware — every card and list populates. **Nothing is
clickable-through:** every row/icon (status rows, today rows, project rows, search, bell,
avatar) has no handler. The work to do here is purely navigation + the 3 top-bar actions.

---

# 3. Work Orders — list (`/work-orders`)

**Files:** `client/src/features/work-orders/WorkOrders.tsx`, `api.ts`, `constants.ts`,
`components/{WorkOrdersTable,WorkOrdersActions}.tsx`, `backend/src/modules/work-orders/routes.ts`

**Purpose:** Filterable list of work orders with status counts + chips.

**Role visibility:** admin, technician only (client cannot see). **Prices stripped server-side**
for technician via `workOrderListDto()` → `canSeePrices()`.

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| Count chips (Totaal/Open/Onderweg/Spoed/Klaar) | Show per-status counts | `GET /work-orders` (client-side agg) | ✅ |
| Filter chips (Alle/Open/Onderweg/Spoed/Klaar) | Filter by status | client-side | ✅ |
| Search field "Zoek op nummer of klant" | Filter by number/customer | client-side — **no handler** | ❌ dead |
| ⭐ Favorites star | Toggle favorite | — (nothing backs it) | ❌ dead |
| **"Nieuwe werkbon" button** | Create a work order | `POST /work-orders {projectId, title?}` | 🚫 no handler — **can't create** |
| Columns: Werkbon# / Klant / Locatie / Type / Monteur / Status / Datum | Display row | `GET /work-orders` | ✅ |
| 👁 eye (row view) | Open `/work-orders/:id` | `GET /work-orders/:id` (route missing) | ❌ dead |
| Empty state | "Geen werkbonnen gevonden." | conditional | ✅ |

### Data coupling
- **← Project → Customer (HARD):** every row's `customerName`/`city`/`workType` flow from the
  parent project + customer; visibility scoped by project assignment.
- **← Employees (soft):** the `Monteur` column is a name copied at creation — no live link.
- **← Materials (soft):** not on the list (materials live on the detail).

### State summary
List displays perfectly and counts/filters work. But **three core actions are dead**: search
(no-op), favorites (no backing), and the 👁 view (no detail route). Critically, **"Nieuwe
werkbon" has no handler — you cannot create a work order from the UI today**, even though
`POST /work-orders` exists.

---

# 4. Work Order — DETAIL (`/work-orders/:id`)  ★ the core product, **MISSING**

**Files:** the `work-order-detail` folder exists but is **empty** (only an empty
`components/`). **No page component. No route.** `client/src/app/router.tsx` registers **no
`:id` route.**

**Purpose (intended):** the heart of the product — execute the work, report on-site
extra-work/blockages, route through office → client approval with an audit trail, sign off.

**Role visibility (intended):** admin (full), technician (edit tasks/materials/photos on
assigned work, report extra work, **never sees prices**, cannot approve), client (view own +
approve/reject extra work).

### Every intended element + the backend that already supports it
The backend is **production-ready** (25 work-order routes + project extra-work/activity
routes). The entire UI is 🚫 not built. Endpoints available today:

| Intended UI element | Backend endpoint | Wired? |
|---|---|---|
| Load full nested work order | `GET /work-orders/:id` | 🚫 UI missing |
| Edit title | `PATCH /work-orders/:id` (admin) | 🚫 |
| Delete | `DELETE /work-orders/:id` (admin) | 🚫 |
| Supervisor approve | `POST /work-orders/:id/approve` (admin) | 🚫 |
| **Tasks:** add | `POST /:id/tasks` | 🚫 |
| edit description/day/note | `PATCH /:id/tasks/:taskId` | 🚫 |
| delete | `DELETE /:id/tasks/:taskId` | 🚫 |
| reorder (drag) | `POST /:id/tasks/reorder` | 🚫 |
| toggle done | `POST /:id/tasks/:taskId/toggle` | 🚫 |
| start timer | `POST /:id/tasks/:taskId/start` | 🚫 |
| stop timer (→ hours, mark done) | `POST /:id/tasks/:taskId/end` | 🚫 |
| manual hours | `PATCH /:id/tasks/:taskId/hours` | 🚫 |
| **Materials:** add line | `POST /:id/tasks/:taskId/materials` | 🚫 |
| edit (name/qty/unit/price/note) | `PATCH /:id/materials/:matId` | 🚫 |
| delete | `DELETE /:id/materials/:matId` | 🚫 |
| set used quantity | `POST /:id/materials/:matId/usage` | 🚫 |
| toggle on-site/done | `POST /:id/materials/:matId/toggle` | 🚫 |
| **Photos:** before | `POST /:id/tasks/:taskId/photos/before` | 🚫 (also needs file storage) |
| result | `POST /:id/tasks/:taskId/photos/result` | 🚫 (needs storage) |
| delete | `DELETE /:id/tasks/:taskId/photos` | 🚫 |
| **Extra work:** report | `POST /projects/:id/extra-work` | 🚫 |
| office-approve | `POST /projects/:id/extra-work/:mwId/approve-office` (admin) | 🚫 |
| client-approve | `POST /projects/:id/extra-work/:mwId/approve-client` (client) | 🚫 |
| reject | `POST /projects/:id/extra-work/:mwId/reject` | 🚫 |
| toggle done | `POST /projects/:id/extra-work/:mwId/toggle-done` | 🚫 |
| **Activity / audit trail** | `GET /projects/:id/activity` | 🚫 |
| add comment | `POST /projects/:id/comments` | 🚫 |
| **Complete all** materials | `POST /:id/complete-all` | 🚫 |
| **Sign off / finish** | `POST /:id/finish {signature}` | 🚫 |
| Drawings | `POST /:id/drawings` | 🚫 (needs storage) |

### Data coupling
- **← Project → Customer (HARD):** detail loads everything via the project.
- **→ Dashboard / Reports (producer):** task hours, extra-work amounts, and status produced
  here are what those screens aggregate.
- **← Materials (soft):** material lines are free-text, optionally seeded from the catalog.
- Photos/drawings/signature need the **file-storage** build before they upload for real.

### State summary
**100% missing on the frontend, 100% ready on the backend.** This is the single biggest gap
and the actual product the client is paying for. Building it is gated by first having a way to
**create** a work order (#3's dead "Nieuwe werkbon") and a registered `:id` route. See
`WERKBONNEN_PLAN.md` (W1–W6) for the phased build of exactly this screen.

---

# 5. Customers (`/customers`)

**Files:** `client/src/features/customers/Customers.tsx`, `api.ts`, `constants.ts`,
`components/{CustomersTable,CustomersActions,TypeBadge}.tsx`,
`backend/src/modules/customers/routes.ts`

**Purpose:** Paginated customer list, filterable by type (business/private), with create/view.

**Role visibility:** admin (full CRUD), client (own linked customer only), technician → 403.

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| KPI cards (Totaal / Zakelijk / Particulier) | Counts by type | derived from `GET /customers` | ✅ |
| Filter chips (Alle / Zakelijk / Particulier) | Filter by type | client-side | ✅ |
| Search "Zoek op naam of stad…" | Search name/city | `GET /customers` — **no onChange** | ❌ dead |
| **"Nieuwe klant" button** | Create customer dialog | `POST /customers` | ❌ dead (no handler) |
| Columns: Naam / Stad / Type / Werkbonnen / Laatste contact | Display row | `GET /customers` (workOrderCount + lastContact aggregated server-side) | ✅ |
| 👁 view (row) | Open customer detail | `GET /customers/:id` (route missing) | ❌ dead |
| Loading / error | Spinner / alert | useApi | ✅ |

### Data coupling
- **PRODUCER (HARD downstream):** projects → work orders all depend on a customer existing.
  Deleting a customer orphans its projects/work orders.
- **← client scope:** a client sees only their own customer (org + customer id check).

### State summary
List, KPIs, type filter, and aggregated columns all work. Dead: search (no onChange), "Nieuwe
klant" (no handler), and 👁 view (no `:id` route) — though `POST /customers` and
`GET /customers/:id` both exist on the backend.

---

# 6. Employees (`/employees`)

**Files:** `client/src/features/employees/Employees.tsx`, `api.ts`, `constants.ts`,
`components/{EmployeesKpis,EmployeesActions,EmployeesTable}.tsx`,
`backend/src/modules/employees/routes.ts`

**Purpose:** Employee roster, filterable by function (field/office) + status, admin-only CRUD.

**Role visibility:** **admin only** (backend 403s everyone else; a technician may read only
their own timesheet).

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| KPI cards (Totaal / Monteurs / Kantoor / Actief) | Counts | derived from `GET /employees` | ✅ |
| Filter chips (Alle / Monteurs / Kantoor / Inactief) | Filter | client-side | ✅ |
| Search "Zoek medewerker…" | Search by name | `GET /employees` — **no onChange** | ❌ dead |
| **"Nieuwe medewerker" button** | Create employee dialog | `POST /employees` | ❌ dead (no handler) |
| Columns: Naam / Functie / Werkbonnen / Status | Display row | `GET /employees` (workOrderCount aggregated across project roles) | ✅ |
| ⋮ more (row menu) | Edit / delete menu | `PATCH` / `DELETE /employees/:id` | ❌ dead (no menu) |
| Empty state | "Geen medewerkers gevonden." | conditional | ✅ |
| Loading / error | Spinner / alert | useApi | ✅ |

### Data coupling
- **PRODUCER (the technician roster):** Work Orders (`Monteur` column), Planning (assignment),
  Projects (projectLeader / teamLeader / installers) all consume employees. Soft — stale name
  if renamed; no back-sync.

### State summary
List, KPIs, filters, columns all work. Dead: search (no onChange), "Nieuwe medewerker" (no
handler), and the ⋮ row menu (no menu component) — backend create/edit/delete all exist.

---

# 7. Materials (`/materials`)

**Files:** `client/src/features/materials/Materials.tsx`, `api.ts`, `constants.ts`,
`components/{MaterialsKpis,MaterialsTable,MaterialsActions}.tsx`,
`backend/src/modules/materials/routes.ts`

**Purpose:** Material catalog with stock levels, categories, and stock-status badges.

**Role visibility:** admin (full), technician (read-only), client → 403.

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| KPI cards (Totaal / Bijna op / Uitverkocht / Voorraad OK) | Counts by stock status | derived from `GET /materials` | ✅ |
| Filter chips (Alle / Voorraad OK / Bijna op / Uitverkocht) | Filter by status | client-side | ✅ |
| Search "Zoek materiaal…" | Search name/category | — **no handler** | ❌ dead |
| **"Materiaal toevoegen" button** | Create material dialog | `POST /materials` (admin) | ❌ dead (no handler) |
| Columns: Naam / Categorie / Eenheid / Voorraad / Min. voorraad / Status | Display row | `GET /materials` | ✅ |
| 👁 eye (row view) | Open material detail | — | ❌ dead (no handler) |
| Empty state | "Geen materialen gevonden." | conditional | ✅ |
| Loading / error | Spinner / alert | useApi | ✅ |

### Data coupling
- **PRODUCER (soft reference):** the catalog is referenced by work-order material lines, but
  those lines are **free-text** — no hard binding. Otherwise materials is independent.
- Backend has a system-level check (`materialsAvailable()`) gating a project to `planned`, but
  that's not a UI coupling.

### State summary
Catalog, KPIs, filters, columns all work (admin/technician read). Dead: search, "Materiaal
toevoegen", and 👁 view — full backend CRUD + inventory routes exist but the UI calls none.

---

# 8. Planning (`/planning`)

**Files:** `client/src/features/planning/Planning.tsx`, `api.ts`, `constants.ts`,
`transform.ts`, `components/{PlanningActions,DayStrip,WeekGrid,DetailsPanel}.tsx`,
`backend/src/modules/planning/routes.ts`

**Purpose:** Week/day/month calendar of scheduled projects with technician assignment + an
event details panel.

**Role visibility:** admin (full), technician (read-only, scoped to own projects), client → 403.

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| Dag/Week/Maand toggle | Switch view | state saved — **only week renders** | ⚠️ partial |
| **"Nieuwe afspraak" button** | Schedule a new slot | `POST /projects/:id/planning` | ❌ dead (no handler) |
| ‹ prev week | Go back a week | — | ❌ dead |
| › next week | Go forward a week | — | ❌ dead |
| Day chips (Ma–Zo) | Highlight today / select day | highlights today; **no onClick** | ⚠️ partial |
| Month/year label | Show month + year | computed | ✅ |
| Time column (08:00–18:00) | Hour labels | static | ✅ |
| Event box (customer + type) | Select → details panel | `onSelect(e.id)` | ✅ |
| Event position/color | Place by time, color by type | computed | ✅ |
| Details: customer / type / time / status | Show selected event | `GET /planning` | ✅ |
| Details: **address** | Show location | ⚠️ **BUG** — maps from `vehicle`, not address (`transform.ts`) | ⚠️ |
| Details: **monteur** | Show technician name | ⚠️ **BUG** — shows `teamLeaderId`, not the name | ⚠️ |
| Details: "Werkbon openen" | Open the work order | — | ❌ dead |
| Details: "Bewerken" | Reschedule/reassign modal | `PATCH /projects/:id/planning` | ❌ dead |

### Data coupling
- **↔ Projects (HARD, bidirectional):** reads scheduled projects via `GET /planning`; writing
  a schedule mutates `plannedDate`/`plannedEndDate` and advances project status
  (`sales → operations`).
- **← Employees (soft):** API returns assignment as **IDs only**; `transform.ts` shows the ID,
  not the employee name (the bug above) — needs an employee-name lookup.
- **→ Materials (soft, system-level):** backend gates `planned` on `materialsAvailable()`; no UI link.

### State summary
Display works (grid, events, selection). **All write/nav actions are dead:** week nav chevrons,
"Nieuwe afspraak", and both details-panel buttons. **Two real bugs in `transform.ts`:** address
is filled from `vehicle`, and `monteur` shows an employee ID instead of a name. Day/Maand views
are accepted but never rendered.

---

# 9. Reports (`/reports`)

**Files:** `client/src/features/reports/Reports.tsx`, `api.ts`, `constants.ts`,
`components/{ReportsActions,ReportsKpis,WeeklyChart,RecentReports,TopMonteurs}.tsx`,
`backend/src/modules/reports/routes.ts`

**Purpose:** Analytics — KPI cards, weekly work-order bar chart, recent projects, top employees.

**Role visibility:** admin, technician (backend is admin-only; nav shows both).

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| KPI cards (Werkbonnen / Uren / Omzet / Materiaalkosten) | Aggregates | `GET /reports` | ✅ |
| Weekly chart (per week, 5 wks) | Bar chart | `GET /reports` (workOrdersPerWeek) | ✅ |
| Recent reports rows | List recent projects | `GET /reports` (recentProjects) | ⚠️ display only — cursor:pointer but **no onClick** |
| Top Monteurs table | Rank employees by WO count | `GET /reports` (`_count` of project roles) | ✅ (display) |
| **Export button** | Export to file (CSV/PDF) | — (no endpoint) | ❌ dead |

### Data coupling (pure consumer)
- **← Work Orders / Projects / Invoices / Employees:** all read-only aggregates. The recent
  rows and top-employee rows do not link through to those screens.

### State summary
Fully wired to `GET /reports` — cards, chart, and top employees hydrate from live data. Dead:
the Export button (no handler, no backend), and recent rows look clickable but navigate nowhere.

---

# 10. Settings (`/settings`)

**Files:** `client/src/features/settings/Settings.tsx`, `constants.ts`,
`components/{ProfileForm,CompanyForm,NotificationsForm,PreferencesForm,GroupLabel,ToggleRow}.tsx`
— **no backend settings module exists.**

**Purpose:** Four-tab settings — Profiel / Bedrijf / Meldingen / Voorkeuren.

**Role visibility:** all roles (no backend enforcement — because there's no backend).

### Every UI element / button / action
| Element | What it should do | Backend / data | Wired? |
|---|---|---|---|
| **Profiel:** change/delete photo | Upload/remove avatar | none (needs storage + endpoint) | 🚫 |
| Voornaam / Achternaam / E-mail / Telefoon / Functie | Edit + persist profile | needs `PATCH /auth/me` (not built) | ❌ dead (defaultValue, no onChange) |
| **Bedrijf:** naam / e-mail / adres / telefoon / BTW | Edit + persist org | needs org PATCH (not built) | ❌ dead |
| **Meldingen:** 4 toggles (nieuwe werkbon / spoed / meerwerk / wekelijks) | Save notification prefs | needs prefs endpoint (not built) | ❌ dead (defaultChecked, no onChange) |
| **Voorkeuren:** Taal select | Switch NL/EN | needs prefs / i18n | ❌ dead |
| Voorkeuren: Thema select | Light/dark/system | needs prefs | ❌ dead |
| **Voorkeuren: "Prijzen tonen aan monteurs" toggle** | Control technician price visibility app-wide | needs org setting → `canSeePrices` | ❌ dead |
| Footer: "Annuleren" | Discard changes | — | ❌ dead |
| Footer: "Opslaan" | Persist active tab | needs multi-endpoint save | ❌ dead |

### Data coupling
- **Would be a PRODUCER:** the "Prijzen tonen aan monteurs" toggle, if wired, would set the
  org-level `canSeePrices` config consumed by Work Orders / Planning / Reports. Today it's
  hardcoded by role and **cannot be changed**.
- Profile/company fields would sync with `/auth/me` + an org endpoint — **neither is built.**

### State summary
**100% UI mockup, zero persistence.** Every field is `defaultValue`/`defaultChecked` with no
onChange; both footer buttons are dead; there is **no backend settings module at all**.
Wiring this needs new endpoints (`PATCH /auth/me`, org settings, notification prefs) — see
`PLAN.md` Phase 4.

---
---

## What to build, in priority order (derived from the gaps above)

This plan is the *map*; the build order lives in `PLAN.md` (9 phases) and `WERKBONNEN_PLAN.md`
(the detail screen, W1–W6). Reconciling them against this audit:

1. **Work-order create + detail screen (#3 "Nieuwe werkbon" → #4).** The biggest gap and the
   core product. Backend is fully ready; it's pure frontend + one `:id` route.
   → `WERKBONNEN_PLAN.md` W1 (create) → W2 (tasks) → W3 (sign-off).
2. **Navigation wiring everywhere.** Almost every list's 👁/row/chevron is dead. Wire
   Dashboard click-throughs, list → detail routes (work orders, customers, materials), and
   Planning's "Werkbon openen". Mostly `navigate()` calls + 3–4 new `:id` routes.
3. **Create/search on the lists.** "Nieuwe klant" / "Nieuwe medewerker" / "Materiaal
   toevoegen" dialogs (backends exist), and wire the dead search fields (client-side filter).
4. **Planning write paths + 2 bug fixes.** Week nav, "Nieuwe afspraak", "Bewerken"; fix
   `transform.ts` address-from-vehicle and monteur-shows-ID.
5. **Settings backend + wiring (`PLAN.md` Phase 4).** New endpoints (`PATCH /auth/me`, org,
   prefs) + the hide-prices toggle → real `canSeePrices` config; then wire all four tabs.
6. **Auth completeness.** Forgot-password + 2FA code step (backends exist).
7. **File storage (`PLAN.md` Phase 2).** Unblocks work-order photos, drawings, signature image,
   the pre-job photo check, and the Settings avatar.
8. **Reports export + row links** (lower priority — pure consumer screen).

### Rules that hold across every screen
- **Figma is the spec** — if a screen needs a field the backend lacks, extend the backend.
- **English internals, Dutch display-only** (i18n later).
- **Technician never sees prices** (`canSeePrices`); **client sees only their own data**.
- **Every mutation** is transactional + writes the audit log (the activity trail).
- Verify with `tsc --noEmit` + `vite build` + vitest + curl. **No Playwright / browser tests.**
- **No auto-commit**; no Claude signature on commits.
