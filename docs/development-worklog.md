# Opero development worklog

This log records requested and delivered Opero changes for review, handover, and
billing reconciliation. It describes the business result rather than only the
files that changed.

## Administration rules

- Add one entry for every independently reviewable change.
- Record ideas as `Planned`; move them to `In progress` only when implementation
  starts.
- Record verification evidence before marking an entry `Ready for review`.
- Kevin reviews changes before they are merged into the production branch.
- Never estimate or reconstruct hours without a reliable time record. The
  `Billable time` field stays `To reconcile` until confirmed from a timesheet.
- Link future pull requests and invoice references to the stable work item ID.

## Status summary

| ID | Change | Environment | Status | Billable time |
| --- | --- | --- | --- | --- |
| OPR-2026-001 | Recovery point before process automation | Local | Complete | To reconcile |
| OPR-2026-002 | Automatic project lifecycle statuses | Local | Ready for review | To reconcile |
| OPR-2026-003 | Configurable work-order controls and in-app reminders | Local | Ready for review | To reconcile |
| OPR-2026-004 | Remove rejected standard-task implementation | Local | Complete | Review classification |
| OPR-2026-005 | Improve control settings field spacing | Local | Ready for review | To reconcile |
| OPR-2026-006 | Work-order material request workflow | Local | Planned | Not started |
| OPR-2026-007 | Contact person selection during work-order creation | Local | Ready for review | To reconcile |
| OPR-2026-008 | Shared customer contacts and work-order contact management | Local | Ready for review | To reconcile |
| OPR-2026-009 | Multiple account roles with active role switching | Local | Ready for review | To reconcile |
| OPR-2026-010 | Show assigned roles in the employee overview | Local | Ready for review | To reconcile |
| OPR-2026-011 | Simplify work-order detail and separate notes from activity | Local | Ready for review | To reconcile |
| OPR-2026-012 | Mention people in work-order notes | Local | Ready for review | To reconcile |
| OPR-2026-013 | Show task photos in the work-order attachments overview | Local | Ready for review | To reconcile |
| OPR-2026-014 | Clarify the active work-order status | Local | Ready for review | To reconcile |
| OPR-2026-015 | Restore task-photo thumbnails and inline previews | Local | Ready for review | To reconcile |
| OPR-2026-016 | Add drag-and-drop uploads | Local | Ready for review | To reconcile |
| OPR-2026-017 | Clarify work-order release state | Local | Ready for review | To reconcile |
| OPR-2026-030 | Prepare company-owned hosting, handover import, and customer subdomains | Local | Ready for review | To reconcile |

## Work items

### OPR-2026-001 — Recovery point before process automation

- **Date:** 26 September 2026
- **Request:** Preserve the working version before changing automated processes.
- **Delivered:** Created a Git commit, branch, tag, and portable bundle from the
  known working state.
- **Recovery reference:** commit `8a94b3e`, tag
  `opero-backup-2026-09-26-before-automation`.
- **Bundle:** `opero-backup-2026-09-26-before-automation.bundle` next to the
  repository directory.
- **Status:** Complete.
- **Review:** No production deployment.
- **Billable time:** To reconcile.

### OPR-2026-002 — Automatic project lifecycle statuses

- **Date:** 26 September 2026
- **Request:** Automate the operational project process without manually assigning
  project statuses.
- **Delivered:** Project status is derived from actual work orders, planning,
  assignments, work progress, signatures, invoices, payments, and archive state.
- **Visible statuses:** New, Work preparation, Scheduled, In progress, Ready to
  invoice, Invoiced, Completed, and History.
- **Interface changes:** Project lists, project details, dashboard counts, filters,
  and Dutch/English labels use the derived lifecycle.
- **Verification:** Shared logic tests, backend integration tests, type checks, and
  the client production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-003 — Configurable work-order controls and in-app reminders

- **Date:** 26 September 2026
- **Request:** Upgrade `Pre-job check` into centrally managed `Controls`, with a
  time and optional notification per control.
- **Delivered:**
  - Central control configuration in Settings.
  - Optional reminder switch and time per control.
  - Existing active work orders backfilled with their missing controls.
  - Reminder settings propagated to active, unsigned work orders.
  - The assigned technician or project leader receives a due in-app notification.
  - Staff can complete a control on the work order; the related notification then
    disappears.
  - `Materials ready` defaults to a 14:00 reminder on the previous workday.
- **Current limitation:** Notifications are shown inside Opero through the existing
  notification bell. Browser and phone push delivery are not implemented yet.
- **Verification:** Database migrations applied locally; client and shared type
  checks pass; production build passes; full backend suite passes with 44 files and
  365 tests.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-004 — Remove rejected standard-task implementation

- **Date:** 26 September 2026
- **Decision:** The separate `Standard tasks` feature duplicated the purpose of
  Controls and did not support the required material-submission action.
- **Delivered:** Removed its settings interface, API, database model, migration,
  test data, and locally created task rows. Confirmed that no standard-task
  references or generated rows remain.
- **Status:** Complete; no residual production feature.
- **Billing classification:** Review whether this correction is billable or internal
  rework before invoicing.

### OPR-2026-005 — Improve control settings field spacing

- **Date:** 26 September 2026
- **Request:** Prevent adjacent `Time` labels and fields from visually touching.
- **Delivered:** Increased horizontal spacing between the control text and time
  fields, and vertical spacing between control rows using the shared design tokens.
- **Verification:** Client type check and production build pass.
- **Status:** Ready for review; included with OPR-2026-003.
- **Billable time:** To reconcile, normally grouped with OPR-2026-003.

### OPR-2026-006 — Work-order material request workflow

- **Date proposed:** 26 September 2026
- **Request:** Let a technician actually submit tomorrow's required materials from
  the control instead of only ticking a checkbox.
- **Planned result:**
  - `Submit materials` action on the correct work order.
  - Catalog selection with variant, quantity, unit, note, and required date.
  - Explicit `No materials needed` option.
  - Automatic completion of the related control after submission.
  - Notification and central queue for the project leader and office/planning.
  - Request lifecycle: Draft, Submitted, Processing, Ordered or Prepared, Ready.
  - Technician can see the current processing status.
- **Architecture decision:** Store a material request separately from a purchase
  order because requested items can also be fulfilled from stock.
- **Status:** Planned; no implementation started.
- **Acceptance and verification:** To define before implementation.
- **Billable time:** Not started.

### OPR-2026-007 — Contact person selection during work-order creation

- **Date:** 26 September 2026
- **Request:** Select or create the visit contact while creating a work order,
  prevent duplicate contact records, and make all contacts visible from the
  customer overview.
- **Delivered:**
  - The new-work-order flow can select multiple contacts after selecting the
    customer and project; selecting a contact is optional.
  - Missing contacts can be created one after another without leaving that flow.
  - Contact fields are optional, so a record can start with only the information
    currently known, such as a telephone number without an email address.
  - Selected contacts are linked to the customer and project and are stored as
    contacts for that specific work order. The same person can later be linked to
    another customer without creating a copy.
  - Duplicate checks compare email addresses without case sensitivity and compare
    Dutch telephone numbers across common `06`, `+31`, and `0031` formats.
  - Duplicate creation is blocked in both the interface and API; the interface
    identifies the existing contact and customer.
  - The work-order screen and exported work-order/quote PDFs use the selected
    contacts, with fallbacks for older work orders.
  - The Customers screen now has a Contact persons view showing each contact's
    customer and linked projects.
- **Verification:** Database migration applied locally; shared, backend, and client
  type checks pass; client and backend production builds pass; lint has no errors;
  the full backend suite passes with 45 files and 372 tests, including seven new
  contact-flow integration tests.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-008 — Shared customer contacts and work-order contact management

- **Date:** 26 September 2026
- **Request:** Reuse one real contact person across multiple customers and remove
  contacts from a work order or customer without creating duplicates or deleting
  links that belong elsewhere.
- **Delivered:**
  - An existing contact can be linked to an additional customer from the
    duplicate warning instead of being copied.
  - Customer and organization-wide contact views show the shared relationship.
  - Removing a shared contact from one customer unlinks only that customer's
    projects and work orders; other customer links remain intact.
  - The work-order information panel can add or remove multiple selected contacts
    for that visit, including clearing the selection completely.
- **Verification:** Database migration applied locally; shared, backend, and client
  type checks pass; production builds and lint pass; the full backend suite passes
  with 46 files and 376 tests, including shared-contact and unlinking coverage.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-009 — Multiple account roles with active role switching

- **Date:** 26 September 2026
- **Request:** Give one employee multiple account roles, such as planning and
  technician, while keeping each role's view and permissions focused.
- **Delivered:**
  - Account management accepts one or more assigned staff roles.
  - The profile screen lets the employee switch between assigned roles.
  - Opero stores the active role and immediately applies its navigation, view,
    API permissions, and price visibility.
  - Existing accounts are migrated with their current role as the initial
    assigned role.
- **Verification:** Database migration applied locally; shared, backend, and client
  type checks pass; production builds and lint pass; the full backend suite passes
  with 46 files and 376 tests, including active-role permission coverage.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-010 — Show assigned roles in the employee overview

- **Date:** 26 September 2026
- **Request:** Make each employee's assigned account roles visible directly in
  the employee overview.
- **Delivered:** Added a Roles column to the desktop table and role badges to the
  mobile employee cards. Accounts with multiple roles show every assigned role;
  employees without a login show no role assignment.
- **Verification:** Client type check and production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-011 — Simplify work-order detail and separate notes from activity

- **Date:** 26 September 2026
- **Request:** Reduce clutter on the work-order screen while keeping tasks and
  controls immediately visible, and separate human notes from system activity.
- **Delivered:**
  - Tasks and Controls remain visible as the two primary work areas.
  - Details, Attachments, Notes, and Activity open in focused right-side panels.
  - The header uses one compact group of icon actions with accessible tooltips;
    only the main completion action keeps a permanent text label.
  - Attachment and note icons show their current item count.
  - Notes contain only manually entered comments and retain the note composer.
  - Activity contains only automatic system events.
  - On narrow screens, Controls appear before the longer task list.
- **Verification:** Client type check, lint, and production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.
### OPR-2026-012 — Mention people in work-order notes

- **Date:** 26 September 2026
- **Request:** Let the author of a work-order note tag another person with `@`.
- **Delivered:**
  - Typing `@` opens an account picker filtered by name or email.
  - A selected mention stores the stable user ID, so duplicate first names do not
    notify the wrong person.
  - Mentioned names are highlighted inside saved notes.
  - The mentioned account receives an in-app notification with the note author,
    a short preview, and a direct link to the originating work order.
  - The picker only offers active accounts that can currently open the project.
- **Verification:** Shared, backend, and client type checks pass; client lint has
  no errors; the focused backend integration test passes; the live local API
  returns mention candidates for the tested work order.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-013 — Show task photos in the work-order attachments overview

- **Date:** 26 September 2026
- **Request:** Make photos added to an individual task visible from the central
  Attachments panel as well.
- **Delivered:** Task photos are listed centrally, grouped by task and by Before
  or Result, while retaining their original task relationship. The header badge
  includes documents, packing slips, and task photos.
- **Verification:** Client type check, focused lint, and production build pass
  locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-014 — Clarify the active work-order status

- **Date:** 26 September 2026
- **Request:** Replace the unclear `On the way` label, which did not describe
  where the technician was going.
- **Delivered:** The active status is shown as `In progress` in English and `In
  uitvoering` in Dutch across the overview, filters, work-order header, and PDF.
  It continues to be assigned automatically when a task is started or completed.
  Dispatch remains a separate `Sent` or `Not sent` state.
- **Verification:** Client and backend type checks, the client production build,
  and the complete backend suite with 47 files and 378 tests pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-015 — Restore task-photo thumbnails and inline previews

- **Date:** 26 September 2026
- **Request:** Show an uploaded task photo immediately as a thumbnail and open
  it directly inside Opero instead of requiring a separate browser tab.
- **Cause:** The local upload server returned Helmet's same-origin resource and
  frame headers, while the client and API use separate origins. Direct navigation
  worked, but browser embedding was blocked.
- **Delivered:** Local upload responses now allow cross-origin image rendering
  and the built-in file viewer. Existing and newly uploaded task photos use the
  same fix; no data conversion is required.
- **Verification:** Backend type check and the focused photo integration suite
  with four tests pass. A live request to the existing local photo returns an
  image MIME type, cross-origin resource permission, and no frame-blocking
  headers.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-016 — Add drag-and-drop uploads

- **Date:** 27 September 2026
- **Request:** Allow files to be dragged directly into an upload area.
- **Delivered:** Task-photo grids and the document and packing-slip panels accept
  dragged files, visibly highlight the active drop target, and keep their normal
  upload buttons. Multiple dropped photos are processed sequentially.
- **Verification:** Client type check, focused lint, translation parsing, and the
  production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-017 — Clarify work-order release state

- **Date:** 27 September 2026
- **Request:** Explain what `Not sent` means on a work order.
- **Delivered:** Replaced the ambiguous sent/dispatched wording throughout the
  interface with a release flow: `Not released`, `Release work order`, and
  `Released`. Supporting text explains that the technician cannot register work
  until the controls are complete and the work order is released. The PDF and
  activity text use the same terminology.
- **Verification:** Client and backend type checks, translation parsing, the
  client production build, and the focused PDF suite with twelve tests pass.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-018 — Automatic work-order lifecycle

- **Date:** 27 September 2026
- **Request:** Give every work order one clear end-to-end workflow grouped into
  Preparation, Realization, and Completion.
- **Delivered:**
  - Added the automatic lifecycle `Open`, `Planned`, `Released`, `In progress`,
    `Ready for review`, `Approved`, `Ready to invoice`, `Invoiced`, and
    `Completed`.
  - Grouped those statuses under the three visible phases Preparation,
    Realization, and Completion.
  - Derived every transition from existing records: schedule and assignee,
    release, task activity, sign-off, office approval, invoice draft, invoice
    send, and payment.
  - Kept urgency separate, so an urgent work order remains in its actual
    lifecycle status and shows `Urgent` only as its priority.
  - Added office actions on the work-order header to approve, prepare the
    invoice, mark it invoiced, and register payment.
  - Migrated existing local work orders to the correct new status without
    deleting or recreating work-order data.
  - Updated status filters, counts, PDF labels, project lifecycle rollups, and
    technician dashboard rules to use the same lifecycle.
- **Verification:** Shared, backend, and client type checks pass; the client
  production build passes; lint has no errors; database migration applied
  locally; the full backend suite passes with 48 files and 380 tests.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-019 — Show the work-order name in the overview

- **Date:** 27 September 2026
- **Request:** Make the work-order name visible in the work-order overview next
  to its number and before the customer.
- **Delivered:** Added a `Work order name` column between the work-order number
  and customer on desktop. On smaller screens the name appears directly below
  the number. An empty name is shown as an em dash.
- **Verification:** Backend type check and client production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-020 — Align the dashboard with work-order phases

- **Date:** 27 September 2026
- **Request:** Update the dashboard after introducing the new automatic
  work-order lifecycle.
- **Delivered:** Replaced the old project-status list with a work-order overview
  grouped into Preparation, Realization, and Completion. Each group shows its
  three underlying work-order statuses and live counts. Dashboard cards that
  still count projects now say so explicitly.
- **Verification:** Backend and client type checks, the client production build,
  and focused dashboard and lifecycle tests pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-021 — Clarify the work-order detail header

- **Date:** 27 September 2026
- **Request:** Replace the ambiguous title and badges with the identifying and
  planning information needed at a glance.
- **Delivered:** The header now shows the work-order ID, name, customer and full
  address on its first line. Its second line shows the planned start and end
  date, phase with exact status, and urgency. Blocked and signed states remain
  visible when applicable. Single-day jobs show the same start and end date.
- **Verification:** Client type check, focused lint, translation parsing, and
  the production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-022 — Drill down from dashboard lifecycle counts

- **Date:** 27 September 2026
- **Request:** Open the matching work orders directly from every status count on
  the dashboard.
- **Delivered:** Every lifecycle row is now a visible link to the work-order
  overview. The selected status is carried in the URL and immediately applied
  to the overview filter. Changing the overview filter updates the URL, so
  refresh, back, and forward navigation preserve the selected status.
- **Verification:** Client type check, focused lint, translation parsing, and
  the production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-023 — Simplify work-order header labels

- **Date:** 27 September 2026
- **Request:** Remove the field labels from the new work-order header and show
  only the values in a compact two-line summary.
- **Delivered:** The first line now shows ID, name, customer, and address. The
  second line shows the planning range, phase with status, and urgency. Values
  are separated by vertical dividers without repeated labels.
- **Verification:** Client type check, focused lint, translation parsing, and
  the production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-024 — Align work-order and project detail headers

- **Date:** 27 September 2026
- **Request:** Give the work-order detail page the same header surface and
  alignment as the project detail page.
- **Delivered:** Removed the separate white card, padding, rounded corners, and
  shadow around the work-order header. The summary and actions now sit directly
  on the page surface with the same top alignment as the project header. The
  existing two-line work-order summary and all actions remain available.
- **Verification:** Client type check, focused lint, and the production build
  pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-025 — Match project and work-order header styling

- **Date:** 27 September 2026
- **Request:** Make the complete work-order header styling and information
  hierarchy match the project detail header.
- **Delivered:** The work-order name is now the prominent title, followed by
  its number and a phase/status badge. Customer, full address, planning, and
  urgency share the secondary detail line. The header actions are displayed as
  separate icon buttons without the contrasting capsule, matching the project
  detail page.
- **Verification:** Client type check, focused lint, and the production build
  pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-026 — Add consistent lifecycle phase colours

- **Date:** 27 September 2026
- **Request:** Make the three work-order phases visually distinct on the
  dashboard.
- **Delivered:** Added one shared colour mapping for the complete work-order
  lifecycle: preparation uses purple, realization uses blue, and completion
  uses green. Each dashboard phase heading has a small matching colour marker,
  and the work-order detail phase badge uses the same mapping.
- **Verification:** Client type check, focused lint, and the production build
  pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-027 — Replace planning time lists with direct input

- **Date:** 27 September 2026
- **Request:** Avoid scrolling through a full 24-hour list when entering normal
  working times in the planning dialog.
- **Delivered:** Replaced both time dropdowns with compact 24-hour time inputs.
  Users can enter the exact start and end time directly. A start time still
  suggests an end eight hours later, including for arbitrary minutes, and the
  form blocks an end time that is not after the start time.
- **Verification:** Client type check, focused lint, translation parsing, and
  the production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-028 — Add horizontal weekly planning timeline

- **Date:** 27 September 2026
- **Request:** Add a readable alternative to the vertical week calendar, with
  time running horizontally and weekdays running vertically.
- **Delivered:** The existing List view switch now opens a horizontal weekly
  timeline from 06:00 to 20:00. Each weekday has its own row and every work
  order card is positioned and sized from its start and end time. Overlapping
  appointments are placed in separate lanes within that day. Week navigation,
  empty-space creation, card selection, multi-day labels, and the existing
  detail panel remain connected.
- **Verification:** Client type check, focused lint, translation parsing, and
  the production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-029 — Separate planning period from display mode

- **Date:** 27 September 2026
- **Request:** Make Agenda and List independent from Day, Week, and Month, and
  keep the selected date when switching display modes.
- **Delivered:** Split the planning controls into a period switch (Day, Week,
  Month) and a separate display switch (Agenda, List). Both display modes now
  support all three periods. Navigation uses one shared date, so moving to a
  future day, week, or month and switching display keeps that same period in
  view.
- **Verification:** Client type check, focused lint, translation parsing, and
  the production build pass locally.
- **Status:** Ready for review; uncommitted local work.
- **Review:** Kevin review required before merge or production deployment.
- **Billable time:** To reconcile.

### OPR-2026-030 — Prepare owned hosting, handover import, and tenant domains

- **Date:** 28 September 2026
- **Request:** Prepare Opero to move from supplier-owned infrastructure to a
  company-owned production environment, decide the hosting layout, and support
  recognizable customer workspaces such as WDB Isolatie for Wesley de Bont.
- **Delivered:** Added optional unique organization workspace slugs, client
  tenant detection, tenant-bound login/session checks, wildcard customer-origin
  support, and customer-specific invitation and password-reset links. Added
  operator tools to assign a workspace slug and import the handed-over file tree
  into private S3-compatible storage while validating organization ownership.
  Documented the recommended Vercel, Railway, PostgreSQL, private object storage,
  email, DNS, ownership, backup, migration, and acceptance setup. Recorded
  `wdbisolatie` as the proposed WDB Isolatie workspace slug. Audited the
  handover: the database contains W.D.B. Isolatie B.V.; 51 of 739 files belong
  to that organization, while 688 files across 28 unknown organization prefixes
  are retained as orphaned recovery data and skipped by the importer. Reviewed
  Kevin's setup guide and aligned the production runbook with its Supabase
  PostgreSQL and private Supabase Storage route, while adding the missing tenant
  domain variables, current migration count, production backup requirement, and
  corrected deployment order. Added handover-data Git protections, dedicated
  production environment templates, and an executable production launch
  checklist with the confirmed WDB workspace and migration counts.
- **Migration:** Adds nullable unique `Organization.slug`; existing organizations
  keep working through the canonical application URL until a slug is assigned.
- **Verification:** Shared, backend, and client type checks passed; backend lint
  passed; client lint passed with two pre-existing warnings; backend and client
  production builds passed; all 385 backend tests across 50 files passed; the
  migration applied locally; the handover restored into an isolated database;
  all 51 active-organization files passed import validation; and the restarted
  local API returned a healthy database status.
- **Status:** Committed locally as release `b1b7e60`; cloud transfer is pending
  company repository and hosting-account authentication.
- **Review:** Production migration, DNS, and go-live acceptance remain pending.
- **Billable time:** To reconcile.

## Billing reconciliation

| Work item | Confirmed time | Rate | Invoice reference | Approval |
| --- | ---: | ---: | --- | --- |
| OPR-2026-001 |  |  |  |  |
| OPR-2026-002 |  |  |  |  |
| OPR-2026-003 |  |  |  |  |
| OPR-2026-004 |  |  |  |  |
| OPR-2026-005 |  |  |  |  |
| OPR-2026-006 |  |  |  |  |
| OPR-2026-007 |  |  |  |  |
| OPR-2026-008 |  |  |  |  |
| OPR-2026-009 |  |  |  |  |
| OPR-2026-010 |  |  |  |  |
| OPR-2026-011 |  |  |  |  |
| OPR-2026-012 |  |  |  |  |
| OPR-2026-013 |  |  |  |  |
| OPR-2026-014 |  |  |  |  |
| OPR-2026-015 |  |  |  |  |
| OPR-2026-016 |  |  |  |  |
| OPR-2026-017 |  |  |  |  |
| OPR-2026-018 |  |  |  |  |
| OPR-2026-019 |  |  |  |  |
| OPR-2026-020 |  |  |  |  |
| OPR-2026-021 |  |  |  |  |
| OPR-2026-022 |  |  |  |  |
| OPR-2026-023 |  |  |  |  |
| OPR-2026-024 |  |  |  |  |
| OPR-2026-025 |  |  |  |  |
| OPR-2026-026 |  |  |  |  |
| OPR-2026-027 |  |  |  |  |
| OPR-2026-028 |  |  |  |  |
| OPR-2026-029 |  |  |  |  |
| OPR-2026-030 |  |  |  |  |
