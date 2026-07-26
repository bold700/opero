# Roles & Permissions

Central access matrix for the work-order application. This is the **authoritative
source of truth** for who can access which section and what they can do there.
Where the code (the `PERMISSION_MATRIX` in `shared/src/permissions.ts`, the nav in
`client/src/app/navigation.ts`, or the backend `requireRole` guards) disagrees with
this document, **the code is the bug**.

## Roles

| Role | Who they are |
| --- | --- |
| **Admin** | **The owner.** Everything an office user can do, plus the two things that are theirs alone: provisioning logins and configuring the company. |
| **Office** (Kantoormedewerker) | Office staff — planners, administration, sales. The full operational application, but never login provisioning or org configuration. |
| **Technician** (Monteur) | Field service employees who handle work orders and register materials daily. |
| **Customer** (Klant) | The end customer who wants insight into the planning and status of the insulation work. |

**Admin vs Office is a horizontal split, not a rank.** Office does the work; the
owner decides who gets in and how the company is configured. Before Office
existed, a single `admin` flag guarded all 68 endpoints — so the person who
needed to edit a material price also had to be given the power to revoke
everyone's login. The rule that decides every guard:

> A capability is **admin-only** iff it manages **logins**, **org configuration**,
> or an **org-wide config template**. Everything else is operational and open to
> Office.

## Access matrix

| Section / Module | Admin (owner) | Office (Kantoor) | Technician (Monteur) | Customer (Klant) |
| --- | --- | --- | --- | --- |
| **Dashboard** — general overview and statistics | **Full** — all KPIs, statistics and users | **Full** — same operational overview | **Limited** — own tasks and daily schedule | **Limited** — status of own work orders |
| **Work Orders** — management and registration of work activities | **Full** — create, edit and delete | **Full** — create, edit and delete | **Limited** — own work orders, photo & signature | **Limited** — view only and track status |
| **Planning** — calendar and staff assignment | **Full** — full calendar and assignment | **Full** — full calendar and assignment | **Limited** — view own schedule | **None** — not available |
| **Customers** — database with customer data and locations | **Full** — create, edit, delete | **Full** — create, edit, delete | **Limited** — customer info on own work order | **Limited** — manage own profile |
| **Employees** — personnel management and roles | **Full** — incl. deleting anyone | **Full** — but cannot delete an **admin** (see below) | **None** — not available | **None** — not available |
| **Materials** — stock and usage of insulation materials | **Full** — stock, procurement and management | **Full** — stock, procurement and management | **Limited** — register usage on work order | **None** — not available |
| **Reports** — financial and operational reports | **Full** — all reports and exports | **Full** — all reports and exports | **Limited** — view own timesheet | **None** — not available |
| **Settings** — system configuration and notifications | **Full** — system, users and integrations | **Limited** — own profile and notifications only | **Limited** — own profile and notifications | **Limited** — own profile and notifications |

## Legend

- **Full** = Read, write, delete.
- **Limited** = Own data or specific actions only.
- **None** = No access.

## Notes on the subtle cells (implementation intent)

These clarify what "Limited" means per cell so the guards can be written correctly:

- **Work Orders / Technician** — sees and edits **their own** work orders (the ones
  on projects they're assigned to): fill in tasks, add photos, capture the customer
  signature. Not org-wide create/delete.
- **Customers / Technician** — **not** the full customers database. Only the customer
  info attached to a work order they're working on (name, address/location for the
  job). This is read-in-context, not the Klanten management screen.
- **Customers / Customer** — a client does NOT get the Customers section/nav item.
  Their Customer business record (company name, address, locations) is office data,
  owned by admin and **read-only** to the client — they only ever see it as context
  embedded in their own work orders. "Manage own profile" here means the client's
  **login profile** (name/email/phone, password/2FA, notifications), served by
  Settings — NOT editing the business record. So the client nav is just Dashboard,
  Work orders, Settings.
- **Materials / Technician** — read the materials catalog and **register usage** on a
  work order. No stock/procurement management (admin only).
- **Reports / Technician** — only **their own timesheet**, not the company-wide
  financial/analytics reports.
- **Settings / Technician & Customer** — own profile, security (password/2FA), and
  notification preferences. The company/organization settings and user provisioning
  are admin-only.
- **Employees / Technician** — "None" for the Employees management screen. (Viewing
  their *own* timesheet is a Reports-row concern, not the Employees screen.)

## Users / Access (provisioning) — not in the original matrix

Login provisioning (invite / enable / disable) is **admin-only** — the owner's
call, in both the UI and the backend. There is no separate "Access" screen any
more: an account is managed from the record it belongs to, in the account panel
inside the Werknemers / Klanten edit dialog. That panel is admin-only even
though the surrounding page is open to Office.

## The four admin-only capabilities

Everything else operational is open to Office. These are not:

1. **Login provisioning** — `POST /users/invite`, `/:id/resend-invite`,
   `/:id/disable`, `/:id/enable` (the whole `usersRouter`).
2. **Org configuration** — `PATCH /organization`, and the Settings sections
   *Bedrijf* and *Checklist*.
3. **The pre-job checklist template** (`prejobItemsRouter`) — an org-wide
   template that changes the dispatch gate for every work order.
4. **Deleting an employee who holds an admin login** (`DELETE /employees/:id`)
   — the non-obvious one. Deleting an employee cascades into revoking their
   linked login, so delete is also a way to revoke access. The standard rule
   applies: **you can never delete someone at or above your own level.** Office
   removes technicians, other office staff and employees with no login; only an
   admin removes an admin. Without that, an office clerk could delete the
   owner's employee record and lock the owner out of their own company.
   (An admin *can* remove another admin — the self-delete guard guarantees at
   least one active admin survives.)

## Notes for implementers

- The model lives in the predicates in `shared/src/permissions.ts`
  (`isStaff`, `canSeeAllProjects`, `canEditQuoteScope`, `canApproveAsOffice`,
  `canManageAccounts`, `canManageOrgSettings`). Call those rather than
  comparing `role === "admin"` — a bare comparison stays valid TypeScript when
  a role is added, so it fails **silently**.
- Adding a role to `UserRole` deliberately breaks `PERMISSION_MATRIX` at compile
  time. That is the forcing function; fill in the new column rather than
  widening the type locally.
- Office is treated as **the office** for meerwerk: they give the first
  approval, before the client. Do not let a new role fall into the client
  branch of an approval check.
