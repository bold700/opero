# Roles & Permissions

Central access matrix for the work-order application. This is the **authoritative
source of truth** for who can access which section and what they can do there.
Where the code (the `PERMISSION_MATRIX` in `shared/src/permissions.ts`, the nav in
`client/src/app/navigation.ts`, or the backend `requireRole` guards) disagrees with
this document, **the code is the bug**.

## Roles

| Role | Who they are |
| --- | --- |
| **Admin** | The office employee or owner with full control over all business functions. |
| **Technician** (Monteur) | Field service employees who handle work orders and register materials daily. |
| **Customer** (Klant) | The end customer who wants insight into the planning and status of the insulation work. |

## Access matrix

| Section / Module | Admin | Technician (Monteur) | Customer (Klant) |
| --- | --- | --- | --- |
| **Dashboard** — general overview and statistics | **Full** — all KPIs, statistics and users | **Limited** — own tasks and daily schedule | **Limited** — status of own work orders |
| **Work Orders** — management and registration of work activities | **Full** — create, edit and delete | **Limited** — own work orders, photo & signature | **Limited** — view only and track status |
| **Planning** — calendar and staff assignment | **Full** — full calendar and assignment | **Limited** — view own schedule | **None** — not available |
| **Customers** — database with customer data and locations | **Full** — create, edit, delete | **Limited** — customer info on own work order | **Limited** — manage own profile |
| **Employees** — personnel management and roles | **Full** — full personnel management | **None** — not available | **None** — not available |
| **Materials** — stock and usage of insulation materials | **Full** — stock, procurement and management | **Limited** — register usage on work order | **None** — not available |
| **Reports** — financial and operational reports | **Full** — all reports and exports | **Limited** — view own timesheet | **None** — not available |
| **Settings** — system configuration and notifications | **Full** — system, users and integrations | **Limited** — own profile and notifications | **Limited** — own profile and notifications |

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

The **Access** screen (user provisioning: invite/enable/disable logins) is
**admin-only** in both the nav and the backend. It should be treated as an
admin-only section.
