# Roles & Permissions

Central access matrix for the work-order application. This is the **authoritative
source of truth** for who can access which section and what they can do there.
Where the code (the `PERMISSION_MATRIX` in `shared/src/permissions.ts`, the nav in
`client/src/app/navigation.ts`, or the backend `requireRole` guards) disagrees with
this document, **the code is the bug**.

## Roles

| Role | Who they are |
| --- | --- |
| **Admin** | **The owner.** Everything an office user can do, plus what is theirs alone: configuring the company, and acting on *any* account — including other admins and office staff. |
| **Office** (Kantoormedewerker) | Office staff — planners, administration, sales. The full operational application, **including inviting technicians and customers**, but never org configuration and never an account at or above their own level. |
| **Technician** (Monteur) | Field service employees who handle work orders and register materials daily. |
| **Customer** (Klant) | The end customer who wants insight into the planning and status of the insulation work. |

**Office does the operational job in full; the owner configures the company and
outranks everyone on access.** Before Office existed, a single `admin` flag
guarded all 68 endpoints — so the person who needed to edit a material price
also had to be given the power to revoke everyone's login. Two rules decide
every guard:

> 1. A capability is **admin-only** iff it manages **org configuration** or an
>    **org-wide config template**. Everything else is operational and open to
>    Office.
> 2. Anything touching a **login** — inviting, revoking, or deleting the
>    employee behind it — is open to Office too, but only **downward**: never on
>    an account at or above your own level.

## Access matrix

| Section / Module | Admin (owner) | Office (Kantoor) | Technician (Monteur) | Customer (Klant) |
| --- | --- | --- | --- | --- |
| **Dashboard** — general overview and statistics | **Full** — all KPIs, statistics and users | **Full** — same operational overview | **Limited** — own tasks and daily schedule | **Limited** — status of own work orders |
| **Work Orders** — management and registration of work activities | **Full** — create, edit and delete | **Full** — create, edit and delete | **Limited** — own work orders, photo & signature | **Limited** — view only and track status |
| **Planning** — calendar and staff assignment | **Full** — full calendar and assignment | **Full** — full calendar and assignment | **Limited** — view own schedule | **None** — not available |
| **Customers** — database with customer data and locations | **Full** — create, edit, delete | **Full** — create, edit, delete | **Limited** — customer info on own work order | **Limited** — manage own profile |
| **Employees** — personnel management and roles | **Full** — incl. deleting anyone and managing any account | **Full** — incl. inviting staff; but cannot delete or manage the account of an **admin** or another **office** user (see below) | **None** — not available | **None** — not available |
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
  notification preferences. The company/organization settings are admin-only.
  User provisioning isn't a Settings concern at all — it lives in the account
  panel on Werknemers / Klanten (see below).
- **Employees / Technician** — "None" for the Employees management screen. (Viewing
  their *own* timesheet is a Reports-row concern, not the Employees screen.)

## Users / Access (provisioning) — not in the original matrix

Login provisioning (invite / resend / enable / disable) is open to **Admin and
Office**, but gated **per target, not at the door**. The one rule:

> **You can never act on an account at or above your own level** — neither
> creating one, nor revoking one.

So Office invites, resends, disables and enables **technicians and clients**,
and may never touch an **admin** or **another office user**. Office also cannot
*grant* the admin role when inviting: minting an owner who could then disable
them back would make the revoke restriction meaningless. Admin outranks
everyone and acts on any account (the self-action guards stop the last owner
locking themselves out).

There is no separate "Access" screen any more: an account is managed from the
record it belongs to, in the account panel inside the Werknemers / Klanten edit
dialog. When the actor outranks nobody — an office user looking at an admin's
account — the panel is shown **read-only with a reason**, never hidden. A
missing control reads as a bug.

Levels: `admin` (3) > `office` (2) > `technician` = `client` (1). Technician and
client are peers at the bottom and never manage accounts at all.

## The admin-only capabilities

Everything else operational is open to Office, **including inviting staff and
customers**. These are not:

1. **Org configuration** — `PATCH /organization`, and the Settings sections
   *Bedrijf* and *Checklist*.
2. **The pre-job checklist template** (`prejobItemsRouter`) — an org-wide
   template that changes the dispatch gate for every work order.
3. **Acting on a peer-or-above account** — `POST /users/invite` (granting a role
   at or above your own), `/:id/resend-invite`, `/:id/disable`, `/:id/enable`.
   Enforced per-target by `canActOnAccount` / `canGrantRole`, not by a blanket
   `requireRole("admin")` on the router.
4. **Deleting an employee who holds a peer-or-above login**
   (`DELETE /employees/:id`) — the non-obvious one. Deleting an employee
   cascades into revoking their linked login, so delete is also a way to revoke
   access and must not be a way around rule 3. The same predicate applies:
   Office removes technicians and employees with **no** login; only an admin
   removes an admin or an office user. Without that, an office clerk could
   delete the owner's employee record and lock the owner out of their own
   company. (An admin *can* remove another admin — the self-delete guard
   guarantees at least one active admin survives.)

## Notes for implementers

- The model lives in the predicates in `shared/src/permissions.ts`
  (`isStaff`, `canSeeAllProjects`, `canEditQuoteScope`, `canApproveAsOffice`,
  `canManageAccounts`, `canManageOrgSettings`, `canActOnAccount`,
  `canGrantRole`, `grantableRoles`). Call those rather than
  comparing `role === "admin"` — a bare comparison stays valid TypeScript when
  a role is added, so it fails **silently**.
- Account access takes **two** predicates, and using only the first is the easy
  bug: `canManageAccounts(actorRole)` says whether the panel appears at all,
  while `canActOnAccount(actorRole, targetRole)` says whether *this* account may
  be touched. Anything that revokes access — including `DELETE /employees/:id`
  — must consult the second.
- Adding a role to `UserRole` deliberately breaks `PERMISSION_MATRIX` at compile
  time. That is the forcing function; fill in the new column rather than
  widening the type locally.
- Office is treated as **the office** for meerwerk: they give the first
  approval, before the client. Do not let a new role fall into the client
  branch of an approval check.
