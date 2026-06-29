# Editability Plan — make every meaningful displayed field editable

Audited every entity: compared the **DTO (what's shown)** against the
**create/update schema (what's editable)** and the **actual UI**. Two kinds of gap:

- **❌ TRUE GAP** — shown, but the *backend* won't accept an edit. Needs a backend
  schema change + a UI input. (4 of these.)
- **⚠️ UI GAP** — backend already accepts the edit; only the *form field* is
  missing. Pure frontend. (Many of these.)

Read-only-by-design fields (id, createdAt, projectNumber, derived counts/status,
computed totals, signedAt, etc.) are intentionally excluded — they should NOT be
editable.

---

## ❌ TRUE GAPS — backend can't edit it yet (do these first)

These need the field added to the update schema/handler **and** a UI control.

| Entity | Field | Input | Allowed values |
|---|---|---|---|
| **Customer** | `type` | dropdown | `business` · `private` |
| **Employee** | `status` | dropdown | `active` · `on_leave` · `inactive` |
| **Material** | `category` | text (or dropdown of existing) | free text (currently forced to "Overig") |
| **Project** | `billingType` | dropdown | `fixed` · `time_and_materials` |

> Note on `customer.type`: today it's auto-guessed from a name regex on create.
> The fix: add it to the create/update schema, keep the regex only as the
> *default* when not supplied, and make it a real editable dropdown.

---

## ⚠️ UI GAPS — backend ready, just need the form field

### Customer
All other fields already editable (name, contact, email, phone, address,
postal, city, notes). ✅ Plus the `type` true-gap above.
**Also missing UI:** contacts + locations management (sub-entities — detail view).

### Employee
Editable backend: name, phone, email, roles. ✅
**Missing UI:** no employee create/edit dialog exists at all yet → build it
(fields: name, phone, email, **roles** multi-select, **status** dropdown).

### Material
Editable backend: name, unit, + inventory (stock, supplier, reorderPoint). ✅
**Missing UI:** no material create/edit dialog yet → build it
(name, unit, **category** [true-gap], stock/min-stock/supplier via inventory).

### Project (no edit screen exists at all — biggest UI gap)
Backend already accepts edits for **all** of these; there's just no project
edit UI:
- **Header:** name, address, postalCode, city, contactName, contactPhone,
  instructions, insulationType, description, exclusions.
- **Lifecycle controls:** stage (`concept/in_progress/ready/done`),
  status (`sales/operations/closing`), urgency (`normal/urgent/blocked`),
  materialsReady (toggle), billingType (true-gap dropdown).
- **Team:** projectLeader, teamLeader (employee dropdowns), installers (multi-select).
- **Planning:** plannedDate, plannedEndDate (date pickers).

### Work order
- `title` ✅ editable. `approve` ✅ toggle. sign-off ✅.
- **Missing UI:** drawings (needs file storage — Phase 4), manual `hours` override.

### Work-order task
- description ✅, done ✅, workType ✅, assignee ✅.
- **Missing UI:** `note` (text), `day` (text), `hours` (manual number override).

### Task material
- name ✅, quantity ✅, unit ✅, price ✅, done ✅.
- **Missing UI:** `label`, `usedQuantity` (planned-vs-used), `diameter`, `onSite`
  (toggle), `note`.

---

## THE PLAN — phased, do in this order

### Phase 1 — TRUE GAPS (backend + UI) ★ the actual bugs
The 4 fields the backend refuses to edit. Each: add to update schema + handler,
then add the input.
1. **Customer.type** — schema + dialog dropdown. (also fix create to accept it)
2. **Employee.status** — schema + dialog dropdown.
3. **Material.category** — schema + dialog field.
4. **Project.billingType** — schema + (project edit form, Phase 3).

### Phase 2 — Finish the simple CRUD screens (frontend only)
Backends exist; build the missing dialogs in the same pattern as Customers.
1. **Employees** — create/edit/delete dialog (name, phone, email, roles
   multi-select, status dropdown).
2. **Materials** — create/edit/delete dialog (name, unit, category, stock,
   min-stock, supplier).
3. **Customers** — add the `type` dropdown to the existing dialog (Phase 1) +
   contacts/locations in a detail view.

### Phase 3 — Project edit screen (frontend only, biggest)
No project edit UI exists. Build a project detail/edit screen exposing the
header fields, lifecycle controls (stage/status/urgency/billingType/
materialsReady), team assignment, and planned dates — all backed by existing
endpoints.

### Phase 4 — Detail-level editable extras (frontend only)
The smaller per-row fields: task `note`/`day`/manual `hours`; material
`label`/`usedQuantity`/`diameter`/`onSite`/`note`. Add as expandable/secondary
inputs so they don't clutter the main row.

(Photos/drawings stay in the file-storage milestone — they're not field edits.)

---

## Rules (every phase)
- English internals; Dutch/English via i18n. Enum *values* are internal; their
  labels are translated.
- Dropdowns use the real Prisma enum values listed above — no free-text where an
  enum exists.
- Role-gated (admin manages; technician limited; client none) and never leak
  prices to technician.
- Every mutation transactional + audit-logged; milestones → activity feed.
- Verify each with tsc + vite build + vitest + curl. No browser tests. No auto-commit.
