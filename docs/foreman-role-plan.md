# Plan: `foreman` role (meewerkend uitvoerder)

**Requested by client (WDB Isolatie):** j.vanimpelen@wdbisolatie.nl = "meewerkend
uitvoerder, alleen toegang werkbonnen en planning van iedereen" — a working foreman who
sees **all work orders** and **the whole team's planning**, and nothing else.

**Role name:** `foreman` (English internals; Dutch display "Uitvoerder" via i18n).
Note: `TeamRole.Foreman` already exists as an Employee *job function*
(schema.prisma:124) — that is a separate concept from the auth `UserRole` and stays
untouched. The names aligning is intentional, not a collision.

---

## 1. Target permission profile

| Section | Access | Notes |
|---|---|---|
| dashboard | limited | Foreman-shaped payload: org-wide, money-free (reuses technician row shape) |
| work_orders | limited | Sees **all** werkbonnen; may register like a technician (status, hours, materials used, photos, comments) on any of them; may **not** edit quoted scope, prices, or approve meerwerk |
| planning | limited | Sees **everyone's** planning, **read-only** (no scheduling/moving) |
| customers | none | Customer name/address still visible embedded in werkbon payload (same as technician) |
| projects (API) | read-all | Side effect of data-layer visibility (werkbon visibility derives from project visibility). No nav entry. Money stripped via `canSeePrices` |
| employees | none | |
| materials | limited (API only) | No nav entry, but catalog **read** stays allowed (registration flows on the werkbon need variant search). Prices stripped, same as technician |
| reports | none | Company-wide reports stay office-only |
| timesheet | own only | He works on the tools himself → own timesheet like a technician (**assumption, confirm with Wesley**) |
| settings | limited | Own profile/security/notifications only |
| users | none | Cannot provision/manage any account |
| invoices / quotes / prices | none | `canSeePrices(foreman) = false` — same absolute no-prices rule as technician (field staff) |

**Account hierarchy:** `ACCOUNT_LEVEL.foreman = 1` (same tier as technician). Admin and
office can invite/disable/enable a foreman; a foreman manages nobody
(`canManageAccounts` stays admin/office).

---

## 2. The one architectural problem: `canSeeAllProjects` is overloaded

`canSeeAllProjects(role)` (shared/src/permissions.ts:111) currently answers **two
different questions** that happen to have the same answer today:

1. **Data visibility** — "sees every project/werkbon in the org" (visibility.ts,
   work-order visibility, search scope). Foreman → **must be true**.
2. **"Is the office"** — reports gate, money dashboard, client-side `canManage`/
   `canCreate` flags, timesheet payroll access. Foreman → **must be false**.

Adding foreman to it naively would leak reports, create-buttons, and payroll timesheets.
Blindly excluding him breaks his core feature. So the plan **splits the predicate**:

- `canSeeAllProjects(role)` → keeps its name and its literal meaning; becomes
  `admin || office || foreman`.
- **New** `isOffice(role)` → `admin || office`. Every call site that actually means
  "office powers" migrates to it (audit table in §4).

This follows the existing doctrine in permissions.ts: *"The permission model lives HERE
… adding the next role is a change in one file"* — plus a one-time call-site audit
because the old predicate was doing double duty.

---

## 3. Changes by layer

### 3.1 `shared/` (source of truth)

**`shared/src/permissions.ts`**
- `UserRole` union: add `"foreman"`.
- `PERMISSION_MATRIX`: add the foreman column per §1 (comment each non-obvious cell,
  matching the file's existing style).
- Add `isOffice(role)` predicate with a comment explaining the split.
- `canSeeAllProjects`: add foreman + comment ("data visibility, NOT office powers").
- `canSeePrices`: exclude foreman (`role !== "technician" && role !== "foreman"` — or
  invert to an allow-list, which reads better with 5 roles).
- `canSeeMargin`, `canEditQuoteScope`, `canApproveAsOffice`, `canManageAccounts`,
  `canManageOrgSettings`: unchanged (admin/office) — but re-point internals at
  `isOffice()` where identical, so the next role is again a one-file change.
- `ACCOUNT_LEVEL`: add `foreman: 1`.
- `grantableRoles`: add `"foreman"` to the candidate list
  (`["admin","office","foreman","technician"]`) so admin+office can pick it when
  inviting.

**`shared/src/schemas.ts`**
- Line 128 + 147: `z.enum(["admin","office","technician"])` → add `"foreman"`
  (invite + role-change request schemas).
- Line 158 `userRoleSchema`: add `"foreman"`.

### 3.2 Database (`backend/prisma`)

- `schema.prisma` `enum UserRole` (line 34): add `foreman` + update the role comment
  block (lines 28–33).
- New migration `..._user_role_foreman/migration.sql` containing **only**:
  ```sql
  ALTER TYPE "UserRole" ADD VALUE 'foreman';
  ```
  Same constraint as the `office` migration (20260725180000): Postgres cannot use a new
  enum value in the transaction that adds it, so the migration must contain nothing
  else. No backfill — nobody is reclassified.

### 3.3 Backend guards & scoping

Because werkbon/planning visibility derives from `visibleProjectsWhere`, the widened
`canSeeAllProjects` gives foreman org-wide read of projects, work orders, planning,
search and notifications **with zero changes** in those code paths. What remains is the
audit of call sites that meant "office" (§4) plus these explicit spots:

- **`modules/dashboard/routes.ts`** — line 57 `canSeeAllProjects` picks the
  money/office payload → change to `isOffice`. Add an explicit `foreman` branch **before
  the fallthroughs** (the file itself warns new roles fall through to the client
  payload): return a technician-shaped, money-free payload (`technicianProjectRow`)
  built from the **org-wide** scope, `role: "foreman"`.
- **`modules/work-orders/routes.ts`** — line 164 visibility check: widened predicate
  already admits foreman ✓. Explicit `role === "technician"` branches at 309/499 are
  *narrowing* branches; foreman correctly falls into the see-all path ✓. Write paths:
  technician-style registration is gated by visibility (now passes); office-only writes
  stay behind `canEditQuoteScope`/`requireRole("admin","office")` ✓. DTO price
  stripping keys off `canSeePrices` → automatic ✓.
- **`modules/planning/routes.ts`** — read endpoints are `assertNotClient` + scope →
  foreman gets everyone's planning ✓. Write endpoints (225/368/407/442) stay
  `requireRole("admin","office")` → read-only ✓. **No changes needed.**
- **`modules/customers/routes.ts`** — line 63 `if (role === "technician") throw` →
  must also reject foreman: gate on `!isOffice(role) && role !== "client"`. Line 45
  (helper that lets office read any customer) → `isOffice`.
- **`modules/search/routes.ts`** — line 41: technician gets no customer results;
  foreman likewise (same condition change).
- **`modules/reports/routes.ts`** — line 20 `requireStaff` uses `canSeeAllProjects` →
  `isOffice` (foreman must NOT gain company reports).
- **`modules/employees/routes.ts`** — line 470 timesheet guard: `isOffice(role) ||
  ((role === "technician" || role === "foreman") && user.employeeId === employeeId)`.
- **`modules/notifications/routes.ts`** — line 139 `newWorkOrder` fires only for
  `role === "technician"`; a foreman can be an assignee → include foreman.
  `urgentOnSite` uses `isStaff` → already includes foreman ✓.
- **`modules/materials/routes.ts`** — line 57 read gate is `isStaff` → foreman keeps
  catalog read (needed by werkbon material registration); admin routes stay
  `requireRole("admin","office")` ✓. **No changes needed.**
- **`modules/projects/routes.ts`** — line 1034/1035 comment-gate: widened predicate
  admits foreman ✓. Office-only writes stay `requireRole` ✓.
- **`modules/users/routes.ts` + employees invite path** — no gate changes
  (`requireRole("admin","office")` stands); `canGrantRole`/`canActOnAccount` handle
  foreman via `ACCOUNT_LEVEL` ✓. Verify invite/role-change zod now accepts `foreman`
  (§3.1 schemas).
- **`modules/invoices`, `prejob-items`, `organization`, `uploads`** — unchanged
  (office/admin-only or visibility-scoped).

### 3.4 Frontend (`client/src`)

- **`app/navigation.ts`** — foreman appears in: dashboard, work-orders, planning,
  timesheet (per §1 assumption), settings. NOT: projects, customers, employees,
  materials, reports. Concretely: replace the `ALL` list usage with explicit role
  lists where foreman differs (e.g. work-orders/dashboard/settings gain `"foreman"`,
  planning becomes `[...OFFICE, "foreman", "technician"]`, timesheet
  `["foreman", "technician"]`).
- **`app/quickCreate.ts`** — unchanged (OFFICE only; foreman creates nothing).
- **Call-site audit, client half (§4):** `Customers.tsx:44`, `WorkOrders.tsx:36`,
  `CreateWorkOrderDialog.tsx:63`, `Materials.tsx:35`, `MaterialDetail.tsx:49`,
  `Projects.tsx:32`, `ProjectDetail.tsx:45`, `Planning.tsx:37`, `Employees.tsx:61`
  all use `canSeeAllProjects` to mean "office powers" → switch to `isOffice`.
  (Nav already hides most of these pages from foreman, but the flags must be right —
  Planning.tsx especially: foreman reaches that page and `canManage` must be false.)
- **`features/dashboard/Dashboard.tsx`** — line 35 branches on `data.role`; render
  `TechnicianView` for `"foreman"` too (payload is the same shape).
- **`features/work-order-detail/`** — price gating already flows through
  `canSeePrices(role)` (WorkOrderDetail.tsx:90) → automatic ✓.
  `MeerwerkApprovalPanel.tsx:40` `if (role === "technician") return null` → also
  return null for foreman (use `!canApproveAsOffice(role) && role !== "client"` or an
  explicit list).
- **`features/users/`** — `InviteDialog`, `AccountSection`, `EmployeeDialog` build
  options from `grantableRoles()` → pick up foreman automatically ✓. Check
  `AccountSection.tsx:80` (`account.role !== "client"` linking logic) still behaves —
  foreman is an employee-linked login like technician.
- **`features/timesheet/`** — allow foreman (route + nav); API guard change in §3.3.

### 3.5 i18n (`client/src/i18n/locales/nl/`)

- `users.json` roles map: `"foreman": "Uitvoerder"`.
- `settings.json` role labels (line ~61 block): same.
- Any other role-label maps found by `grep -rn '"technician"' client/src/i18n` at
  implementation time (workOrders.json:42 is an assignee-type label — check context).
- Display label decision: "Uitvoerder" (short) over "Meewerkend uitvoerder" (long) —
  confirm with Wesley if he cares.

### 3.6 Seed

- `db/seed.ts` provisions admin/office/technician/client logins. Add a foreman login
  **only** under the `SEED_DEMO=1` block (seed stays clean by default). Not required
  for production — real accounts arrive via invite.

---

## 4. `canSeeAllProjects` call-site audit (the risky part, in one table)

| Call site | Meaning | Action |
|---|---|---|
| projects/visibility.ts:21,70 | data visibility | keep (widened → foreman sees all) |
| work-orders/routes.ts:164 | werkbon visibility | keep |
| projects/routes.ts:1034 | comment/view gate | keep |
| dashboard/routes.ts:57 | money dashboard | → `isOffice` + new foreman branch |
| reports/routes.ts:20 | company reports | → `isOffice` |
| customers/routes.ts:45 | office reads any customer | → `isOffice` |
| employees/routes.ts:470 | payroll timesheet access | → `isOffice` (+ foreman own-only) |
| client: Customers/WorkOrders/CreateWorkOrderDialog/Materials/MaterialDetail/Projects/ProjectDetail/Planning/Employees | "canManage/canCreate" office flags | → `isOffice` |

Also audit every raw `role === "technician"` / `role !== "technician"` (backend list in
§3.3; client: Dashboard.tsx:35, MeerwerkApprovalPanel.tsx:40) — these are exactly the
silent-fallthrough traps the permissions.ts header warns about.

`requireRole("admin", "office")` lists (~70 call sites): **all stay as-is.** Foreman is
deliberately excluded from every one of them.

---

## 5. Tests

Extend existing suites (vitest, backend):

- **`auth/roleGuard.test.ts`** — foreman passes `requireRole` only where listed.
- **`work-orders/role-access.test.ts`** — foreman: sees ALL werkbonnen (not just
  assigned); DTO contains **no** price/cost/margin fields; can update listStatus /
  register hours+materials on an unassigned werkbon; 403 on quoted-line edit and
  office meerwerk approval.
- **`planning`** (new or existing) — foreman: reads all planning items; 403 on every
  write route.
- **Section denials** — foreman: 403 on `/customers`, `/invoices`, `/reports/*`,
  `/users`, employees CRUD, materials admin routes, org settings; 200 on materials
  catalog read; timesheet: own 200, someone else's 403.
- **`provisioning.test.ts`** — office invites a foreman ✓; office disables/enables a
  foreman ✓; foreman appears in `grantableRoles(office)`; role-change to foreman via
  updateUserRoleSchema ✓.
- **shared** — unit tests for `isOffice`, widened `canSeeAllProjects`,
  `canSeePrices("foreman") === false`, `canActOnAccount("office","foreman") === true`,
  `canActOnAccount("foreman", ...) === false` for staff targets.

Verification: `pnpm -r exec tsc --noEmit` (adding a `UserRole` member makes every
non-exhaustive `Record<UserRole, …>` fail to compile — `PERMISSION_MATRIX` and
`ACCOUNT_LEVEL` are deliberately such records, which is our safety net for forgotten
spots), `vite build`, backend vitest.

---

## 6. Rollout order

1. `shared/` permissions + schemas (compiler now flags every `Record<UserRole,…>`).
2. Prisma enum + migration (enum-only, nothing else in it).
3. Backend: §4 audit swaps (`isOffice`), dashboard foreman branch, notification +
   customers/search/timesheet condition fixes.
4. Frontend: navigation, Dashboard branch, MeerwerkApprovalPanel, `isOffice` swaps.
5. i18n labels.
6. Tests (§5), typecheck + build both workspaces.
7. Invite j.vanimpelen@wdbisolatie.nl as `foreman` (plus wesley=admin,
   jveonderhoud=technician; danny pending §7).

## 7. Open questions for Wesley (defaults chosen, none block implementation)

1. **Planning read-only?** Assumed yes (he views everyone's planning but doesn't
   reschedule). If he must move items, planning write routes get
   `requireRole("admin","office","foreman")` — one-line change each.
2. **Own timesheet?** Assumed yes (he's meewerkend — he clocks hours too).
3. **Label** "Uitvoerder" vs "Meewerkend uitvoerder" in the UI.
4. **Danny's role** — unrelated to foreman, still unconfirmed (assumed `office`).
