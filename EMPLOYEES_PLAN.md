# Employees screen — make it fully usable (plan)

Same goal as Customers: the screen currently **only displays**. Wire up
create / edit / delete with proper inputs for every editable field.

---

## What's there now

**Backend (all endpoints exist):**
- `GET /employees` (list + stats), `GET /employees/:id`, `POST`, `PATCH`,
  `DELETE` (soft), `POST /employees/:id/toggle-role`, `GET /employees/:id/timesheet`.
- Create/update schema now accepts: name, phone, email, **roles**, **status**
  (status added in the editability pass).

**Frontend (display-only today):**
- KPI cards (total / technicians / office / active) ✅ work.
- Filter chips (all / technicians / office / inactive) ✅ work.
- Search box → **dead** (no handler).
- "Nieuwe medewerker" button → **dead**.
- Table rows → a `⋮` MoreVert icon that → **dead** (no menu).

---

## The Employee data model — every field, and what it needs

| Field | Type | Editable? | Input |
|---|---|---|---|
| `id` | uuid | no | — (system) |
| `name` | String | ✅ required | text |
| `phone` | String | ✅ | text |
| `email` | String? | ✅ (validated if present) | text |
| `roles` | TeamRole[] | ✅ | **multi-select** (chips) |
| `status` | EmployeeStatus | ✅ | **dropdown** |
| `function` | derived | no | — (computed = primary role) |
| `workOrderCount` | derived | no | — (count of assignments) |
| `createdAt`/`updatedAt`/`deletedAt` | system | no | — |

**`roles` dropdown values (TeamRole enum):**
Sales · WorkPlanner · Planner · Foreman · Technician · Administration · ProjectLeader
→ multi-select; labels already exist in i18n (`employees.roles.*`).
*(Note: i18n is missing `foreman`-vs-others coverage? It has technician, foreman,
workPlanner, planner, projectLeader, administration, sales — all 7 covered. ✅)*

**`status` dropdown values (EmployeeStatus enum):**
active · on_leave · inactive → labels exist (`employees.status.*`).

---

## What to build (mirrors the Customers pattern)

### 1. `api.ts` — add mutations
`createEmployee`, `updateEmployee`, `deleteEmployee`. Add `EmployeeInput` type
(name, phone, email, roles[], status).

### 2. `EmployeeDialog.tsx` — create + edit (one form)
Fields, using the shared `useForm` + validators:
- **Name** — text, required.
- **Phone** — text.
- **Email** — text, email-validated (optional).
- **Roles** — multi-select (MUI Select multiple + Chips), values = TeamRole enum,
  labels via `employees.roles.*`.
- **Status** — dropdown, values = EmployeeStatus, labels via `employees.status.*`.

### 3. Wire the page (`Employees.tsx`)
- Search → client-side filter (by name).
- "Nieuwe medewerker" → open dialog (create). Admin-only.
- `reloadKey` refetch + toast + busy/error, same as Customers.

### 4. Row actions (`EmployeesTable.tsx`)
Replace the dead `⋮` with **edit** + **delete** icon buttons (admin-only),
matching the Customers table. Delete → shared `ConfirmDialog`.

### 5. Actions bar (`EmployeesActions.tsx`)
Take `search` / `onSearch` / `onCreate` / `canCreate` props (lift state to page),
same shape as `CustomersActions`.

### 6. i18n
Add `employees.dialog.*`, `employees.delete.*`, `employees.toast.*`,
`employees.table.empty` (NL + EN). The `roles.*` and `status.*` labels already
exist and get reused.

---

## Decisions (the few that matter)

- **Roles = multi-select**, not single. An employee can be e.g. both Foreman and
  Technician. The list's "function" column stays the derived *primary* role.
- **Status editable via the dialog** (and could also be a quick inline change
  later, but dialog is enough for now — keep it simple).
- **No timesheet / detail view in this pass.** The timesheet endpoint exists but
  that's a separate screen; this pass is CRUD only.
- **Roles labels:** the enum values are internal (English); display via the
  existing `employees.roles.*` i18n. The multi-select stores enum values.

---

## Out of scope (note, don't build now)
- Employee detail page + timesheet view (`GET /employees/:id/timesheet` exists).
- Linking an employee to a login user account.

---

## Verify
tsc + vite build + curl (create → edit roles/status → delete). No browser tests.
Reuse: `useForm`, validators, `ConfirmDialog` — all already built for Customers.
