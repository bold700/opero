# Plan: Combine similar roles (UX review item 1)

Status: **implemented** (2026-08-07). Migration `20260807150000_consolidate_team_roles`.

---

## 1. What the reviewer means (best guess)

The screenshot he sent shows the employee edit sheet with **two role controls on one
form**:

1. **"Rollen"** — job-title checkboxes: Sales, Werkvoorbereider, Planner, Voorman,
   Monteur, Administratie, Projectleider (7 options)
2. **"Toegangsniveau"** (circled in red) — the account access dropdown: Beheerder,
   Kantoormedewerker, Uitvoerder, Monteur (4 options)

The complaint, read together with item 2 ("allow selection of only one role and
manage permissions through account access level"):

> Why does one person get classified twice, in two different lists, that even use
> the same words? "Monteur" appears in both. Voorman and Uitvoerder are the same
> person in different words. Collapse this into one simple choice.

His list ("Admin, Manager, Office Worker, Technician, Customer") is the access-level
list, not the job-title list — which supports this reading: he wants roughly *that*
level of granularity, once, and everything else derived from it.

Note: his screenshot is stale. The checkbox grid is already gone (item 2 shipped a
single-select job title, and permissions already run entirely off the access level).
What remains of his complaint today:

- The form still asks **two role questions** (job title + access level).
- The two vocabularies still **overlap by name** (Monteur/Voorman vs
  Uitvoerder/Monteur).
- The job-title list still has **7 options with near-duplicates**
  (Werkvoorbereider vs Planner, Sales vs Administratie).

---

## 2. Current model (for reference)

| Concept | Field | Values | Drives |
|---|---|---|---|
| Job title | `Employee.role` (`TeamRole`, nullable, single) | Sales, WorkPlanner, Planner, Foreman, Technician, Administration, ProjectLeader | display, office/field list filter, picker narrowing (who is offerable as project leader / technician) |
| Access level | `User.role` (`UserRole`) | admin, office, foreman, technician, client | **all permissions** |

`client` (Customer) is a portal login tied to a Customer record, not an employee —
it stays out of scope entirely.

---

## 3. Proposed target model

**One question on the employee form: "Functie" (function), with 4 options instead
of 7.** The access level stops being a second question — it gets a sensible default
from the function at invite time.

### 3a. Collapse the job-title list 7 → 4

| New value | Dutch label | Absorbs |
|---|---|---|
| `Office` | Kantoor | Sales, WorkPlanner (Werkvoorbereider), Planner, Administration |
| `ProjectLeader` | Projectleider | ProjectLeader |
| `Foreman` | Voorman | Foreman |
| `Technician` | Monteur | Technician |

Rationale: the app only ever *uses* the title for three things — the office/field
filter, the leader picker (ProjectLeader/Foreman), and the technician picker
(Technician/Foreman). Sales/Werkvoorbereider/Planner/Administratie are all
"office" for every one of those purposes, so distinguishing them buys nothing in
the app and costs a 7-item list. This directly answers "combine **similar** roles"
without flattening roles that behave differently (a Voorman is assignable to jobs;
a Kantoormedewerker is not).

### 3b. One visible role question; access level becomes a default

- The employee form keeps **only** the Functie select (4 options + "none yet").
- The **Invite** dialog (where a login is granted) pre-selects the access level
  from the function: Kantoor → `office`, Voorman → `foreman`, Monteur →
  `technician`, Projectleider → `foreman`. Admin is never defaulted — making
  someone Beheerder stays an explicit choice.
- The access dropdown stays in the invite dialog (admins can still override, and
  permission rules are untouched), but for the normal case the office never has to
  answer the question twice: pick a function, invite, done.

### 3c. Fix the overlapping words (i18n only)

Access-level labels get renamed so no word appears in both lists:

| Access level | Now | Proposed |
|---|---|---|
| admin | Beheerder | Beheerder *(unchanged)* |
| office | Kantoormedewerker | **Kantoortoegang** ("office access") |
| foreman | Uitvoerder | **Voormantoegang** |
| technician | Monteur | **Monteurtoegang** |
| client | Klant | Klant *(unchanged)* |

The "-toegang" suffix makes it read as what it is — an access level, not a second
job title. (Exact wording is the client's call; any scheme that stops reusing
"Monteur" bare works.)

---

## 4. Concrete changes

### Database (1 migration)
- Remap: Sales / WorkPlanner / Planner / Administration → `Office`.
- Rebuild the `TeamRole` enum as (`Office`, `ProjectLeader`, `Foreman`,
  `Technician`) — Postgres enums can't drop values in place.

### Backend
- `prisma/schema.prisma` — new enum + `legacyTitle` column.
- `modules/employees/schema.ts` — zod enum → 4 values.
- `modules/employees/routes.ts` — `OFFICE_ROLES` becomes `["Office"]`.
- `modules/employees/assignable-roles.ts` — sets unchanged in meaning
  (`ProjectLeader`/`Foreman` lead, `Technician`/`Foreman` install); values compile
  against the new enum.
- `db/seed.ts`, `db/create-office-user.ts` — seeded office employee gets `Office`.
- New endpoint change: none. Invite defaulting is client-side (the grantable-roles
  logic already exists; the dialog just pre-selects).
- Tests: update fixtures that create employees with old titles; keep the
  office/field filter and both assignability pickers pinned against the new
  values.

### Client
- `features/employees/api.ts` + `constants.ts` — 4-value list; `isOffice()`
  becomes `role === "Office"`.
- `features/employees/components/EmployeeDialog.tsx` — Functie select shows 4
  options. Everything else on the form unchanged.
- `features/users/` invite dialog — pre-select access level from the employee's
  function (overridable, admin excluded from defaults).
- i18n (`employees.json`, `users.json`, nl + en) — 4 function labels; renamed
  access-level labels (3c); remove the 4 absorbed role keys.
- Employee list: the function column shows the 4 new labels.

### Explicitly NOT changing
- Permissions/`UserRole` values and every authorization rule — untouched. This is
  presentation + job-title vocabulary only.
- Customer/client portal logins — out of scope.
- Werkbon/planning/PDF — no dependency on job titles beyond the pickers above.

---

## 5. Open questions for the reviewer/client (answer before or after build)

1. **Does anyone need Sales/Planner/Administratie distinct for reporting or
   payroll-ish reasons?** In-app nothing uses the distinction; after the merge
   everyone office-side is simply "Kantoor".
2. **Access-level label wording** — is "-toegang" acceptable, or does he prefer
   e.g. "Volledige toegang / Kantoor / Veld"?
3. Confirm Projectleider → default access `foreman` (sees all projects, no admin
   powers) — or should a projectleider default to `office`?

---

## 6. Second pass — alternatives considered and rejected

**Alternative A: delete the job title entirely** (access level becomes the only
role). Rejected because employees exist **without logins** — provisioning is
invitation-based, and the list today shows real account-less staff ("Account:
Nee"). Without a title, those people can't be classified at all: the
Monteurs/Kantoor split breaks and the technician/leader pickers can't narrow. Some
per-employee field must exist; the only question is its vocabulary — hence 4
values instead of 7.

**Alternative B: derive the access level fully from the function** (no dropdown
anywhere — invite just asks "give access?"). Rejected for two reasons: it couples
job description to security (a Voorman who should only get monteur-level access
becomes inexpressible), and item 2's own wording — "manage permissions through
account access level" — explicitly keeps the access level as its own concept. The
reviewer's problem is answering the same question twice, not the existence of
access levels. The pre-filled default removes the double entry while keeping the
override.

**Alternative C: keep all 7 titles, only fix labels/defaults.** Rejected — item 1
literally asks to combine similar roles, and the 7-item list with
Werkvoorbereider/Planner and Sales/Administratie near-duplicates is the visible
symptom he circled.

**Known residual redundancy, accepted:** after the merge, three of the four
titles map 1:1 to an access level (Kantoor↔office, Voorman↔foreman,
Monteur↔technician; Projectleider has no access twin). That residue is inherent
to Alternative A being impossible — the invite default means nobody ever *feels*
it as a second question, which is the actual complaint.

**Checked against the code:** the list filters/KPIs bucket `technicians` = title
Monteur only and `office` = the four office titles; post-merge this maps 1:1
(Monteur / Kantoor) with Voorman and Projectleider in neither bucket — behaviour
unchanged. The assignability sets keep their meaning verbatim
(lead: Projectleider+Voorman; install: Monteur+Voorman; untitled: eligible
everywhere).

**Verdict:** the plan stands. The one real business risk is flattening
Sales/Planner/Administratie into Kantoor (open question 1) — everything else is
strictly less confusing than today at no loss of capability.

## 7. Order of work & verification

1. Migration + backend enum/validation/tests → `tsc` + full vitest run
   (35 files / 319 tests currently green).
2. Client constants/dialog/i18n → `tsc` + `vite build`.
3. Invite-default behaviour + its test.
4. Manual pass: employee list filter chips, leader picker, technician picker,
   invite flow with each function.

Rollback story: code revert + one migration re-adding the old enum values. The
per-employee old titles are not preserved (greenfield, demo data — nothing worth
keeping); after a rollback, titles would be re-picked by hand.
