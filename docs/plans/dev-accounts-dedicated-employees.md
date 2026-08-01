# Plan — Dedicated employee records for the seeded dev logins

**Status:** proposed
**Scope:** `backend/src/db/seed.ts` (main), comment hygiene in
`backend/src/modules/invoices/routes.ts` + `backend/prisma/schema.prisma`
**Not in scope:** any change to runtime authorization or the role model.

Everything below marked **VERIFIED** was checked this session by running code,
tests, or DB queries — not by reading.

---

## 0. Summary

The technician demo login (`technician@opero.test`) borrows a mock persona
("Sven Bakker", `tm-004`) picked by array order, and that persona is on the crew
of **every** werkbon — so the per-werkbon visibility rule, though implemented
and test-proven, is invisible in the demo UI. Fix: mint a dedicated demo
technician employee, assign it to a deterministic *subset* of werkbonnen (and
their parent projects' crews), delete the `.find()` hack and the non-demo
mock-employee prop that exists only to feed it.

---

## 1. Verified findings

### 1.1 The backend visibility logic is correct — proven, not inspected

- `backend/src/modules/work-orders/visibility.ts` scopes technicians to
  werkbon-level (`assignees`) or zone-level (`tasks.assigneeId`) assignment;
  fragments merge via `AND` (the projectScopeWhere lesson).
- Every work-order route funnels through `loadProjectForWorkOrder` /
  `requireWritableWorkOrder` (audited each `findUnique*` call site).
- **VERIFIED by test run:** `assignee-scope.test.ts` builds one project with two
  werkbonnen, technician assigned to A only, and asserts B stays hidden across
  list, counts, detail, PDF, hours-registration, global search, dashboard
  `openTaskCount`, project-detail werkbon list, and the planning feed — plus
  admin and foreman still seeing both.

  ```
  npx vitest run src/modules/work-orders/ src/modules/users/
  → Test Files 15 passed (15) | Tests 135 passed (135)
  ```

### 1.2 The demo data defeats the demo — the actual bug

**VERIFIED by DB query** against the seeded dev database:

```
login employeeId: tm-004 => name: Sven Bakker
total werkbonnen in org:   14
visible to this technician: 14
```

Cause chain:

1. `backend/src/db/seed.ts:737` — `seededTeam.find((tm) =>
   tm.roles.includes("Technician"))` resolves to the **first** technician in
   `mockTeamMembers`, which is `tm-004` "Sven Bakker"
   (`shared/src/mock-data.ts:151`). Which human the dev login becomes is a side
   effect of array order in an unrelated file.
2. `shared/src/mock-data.ts:384` (+ 429, 479) — every project's `installerIds`
   is one of two crews, and `tm-004` is in **both** branches.
3. `backend/src/db/seed.ts:452` — `buildWorkOrders` connects the whole project
   crew to every werkbon.

Net: the demo technician is an assignee on 14/14. A correct visibility filter
and a completely broken one render the identical screen.

Secondary: `backend/src/db/seed.ts:162` filters non-demo mode to
`.slice(0, 1)` of the mock technicians purely so the `.find()` keeps resolving —
a clean-slate org ships with a fake "Sven Bakker" employee for no reason.

### 1.3 Facts that shape the fix (all VERIFIED this session)

- **`foreman@opero.test` already exists** — `backend/src/db/seed.ts:811`,
  SEED_DEMO-gated, with its own dedicated "Foreman Demo" employee
  (`roles: ["Foreman"]`). Nothing to do.
- **`TeamRole` has no `Office` member** — `backend/prisma/schema.prisma:124`:
  `Sales | WorkPlanner | Planner | Foreman | Technician | Administration |
  ProjectLeader`. The office demo employee uses **`WorkPlanner`**
  (`seed.ts:763`), matching `create-office-user.ts:87`. Keep that convention.
- **`tm-004` has no other consumers** — grep hits only the three `installerIds`
  ternaries in `shared/src/mock-data.ts`. No test or client fixture depends on
  it; the seed-side fix (§2.3) is safe.
- **Only the technician login lacks a dedicated employee.** Admin
  ("Admin Demo", `Administration`), office ("Office Demo", `WorkPlanner`) and
  foreman ("Foreman Demo", `Foreman`) each already get a purpose-minted record.
  The technician is the single odd one out.

### 1.4 Project visibility is a separate axis — the partial assignment must patch both

`backend/src/modules/projects/visibility.ts:31`: a technician sees a PROJECT via
`teamLeaderId` / `projectLeaderId` / `installers` — **not** via werkbon
assignment. So assigning the demo technician to a werkbon without also putting
them on the parent project's `installers` yields a werkbon in the list whose
parent project detail 404s. Any werkbon assignment in the seed must be mirrored
into that project's installer connect.

---

## 2. Part A — Seed changes

### 2.1 Mint a dedicated demo technician employee

In `seed.ts` §4 (employees section — it must exist **before** the projects loop,
because werkbonnen and installer lists connect to it by id):

```ts
// The technician demo login gets its OWN employee, never a mockTeamMembers
// persona. Binding it to the first mock technician (tm-004 "Sven Bakker") made
// the login's identity depend on array order in shared/src/mock-data.ts — and
// that persona sits on EVERY project crew, so the dev technician saw 14/14
// werkbonnen and the per-werkbon visibility rule was undemonstrable.
const DEMO_TECHNICIAN_ID = "demo-technician";
await prisma.employee.create({
  data: {
    id: DEMO_TECHNICIAN_ID,
    orgId,
    name: "Technician Demo",
    phone: "",
    email: "technician@opero.test",
    roles: ["Technician"] as TeamRole[],
    status: "active",
  },
});
```

The `demo-` prefix cannot collide with `tm-NNN` mock ids. Admin/office/foreman
demo employees stay as they are (uuid ids are fine — the seed wipes and
recreates everything each run; only the technician id is referenced across
sections and needs to be a constant).

### 2.2 Kill the hack; link the login unconditionally

- Delete `seed.ts:737–739` (`technicianEmployeeId` + the `.find()`).
- Drop the `if (technicianEmployeeId)` guard at `:781`; create the technician
  user unconditionally with `employeeId: DEMO_TECHNICIAN_ID`. This *strengthens*
  the linked-login invariant pinned by `modules/users/invariant.test.ts`.
- `seed.ts:162` becomes:

  ```ts
  // Demo mode seeds the full mock team. Otherwise NO mock employees — the demo
  // logins carry their own records, so nothing needs propping up here.
  const seededTeam = SEED_DEMO ? mockTeamMembers : [];
  ```

  `employeeIds` / `validEmployeeId` keep working (empty set → every mock crew
  ref null-filters, and non-demo mode seeds no projects anyway — the projects
  block is SEED_DEMO-gated at `:547`).

Clean-slate result: exactly 3 employees (Admin/Office/Technician Demo), 3
logins, zero mock personas. Demo mode adds the mock team + the foreman login.

### 2.3 Partial werkbon assignment — the piece that makes visibility observable

One pure predicate, used in both places that must agree (§1.4):

```ts
// Put the demo technician on SOME werkbonnen, never all and never none: the
// point of the dev login is to show that a monteur sees only their own visits.
// On every werkbon (as tm-004 was), a broken visibility filter is
// indistinguishable from a working one. Deterministic — no RNG — so the
// expected counts are stable and assertable.
const demoTechOnWerkbon = (projectIndex: number, wbIdx: number) =>
  (projectIndex + wbIdx) % 3 === 0;
```

Wire-up:

- **Werkbon level** (`buildWorkOrders`, `seed.ts:452`):

  ```ts
  assignees: { connect: demoTechOnWerkbon(projectIndex, wbIdx)
    ? [...crew, { id: DEMO_TECHNICIAN_ID }]
    : crew },
  ```

- **Project level** (the project create's `installers` connect, `~seed.ts:600`):
  append `{ id: DEMO_TECHNICIAN_ID }` to the installer connect list iff
  `demoTechOnWerkbon(projectIndex, wbIdx)` is true for **any** wbIdx of that
  project's werkbonnen — otherwise the parent project of a visible werkbon 404s
  (§1.4). The werkbon count per project is known before the create
  (`base.length` in `buildWorkOrders`), so compute it from the same inputs —
  restructure `buildWorkOrders` to also return/report the flag rather than
  duplicating the count logic.

Mock data (`installerIds` ternaries in `shared/src/mock-data.ts`) stays
untouched: those ids also feed planning fixtures and the blast radius isn't
worth it.

### 2.4 Foreman login — nothing to do

Already exists (`seed.ts:811`), correctly built, SEED_DEMO-gated with an
explicit comment that clean slates stay at the essential logins. Keep as is.

---

## 3. Part B — Comment hygiene

1. Rewrite the stale "3-role model" comment
   (`backend/src/modules/invoices/routes.ts:11`) — that model no longer exists.
2. Add axis-documenting comments to `UserRole` and `TeamRole` in
   `schema.prisma`: `UserRole` = "guards live in shared/src/permissions.ts;
   new value ⇒ new PERMISSION_MATRIX row"; `TeamRole` = "job titles;
   display/sort/filter ONLY". Comments only — **no migration**.

---

## 4. Verification

Per project rules: typecheck + vitest + direct DB queries. No browser.

```bash
cd backend && npx tsc --noEmit
```

```bash
cd backend && npx vitest run
```

```bash
cd backend && SEED_DEMO=1 npx tsx src/db/seed.ts
```

Then re-run the visibility count check (same query as the one that produced the
14/14 finding — `visibleWorkOrdersWhere`-equivalent against the seeded DB):

| Login | Before | After (required) |
|---|---|---|
| `technician@opero.test` | 14 / 14 | **strict subset:** `0 < n < total` (~⅓) |
| `foreman@opero.test` | total / total | total / total (unchanged) |
| `admin@opero.test` | total / total | total / total (unchanged) |

Also assert, for every werkbon visible to the demo technician, that its parent
project detail returns 200 for them (the §1.4 pairing).

Clean-slate path:

```bash
cd backend && npx tsx src/db/seed.ts
```

→ exactly 3 employees, 3 users, none named after a mock persona, technician
login present and linked.

---

## 5. Risks

- **Werkbon↔project pairing drift (§2.3):** the two connect sites must use the
  one shared predicate. This is the only genuinely delicate edit; the paired
  200-assertion in §4 catches a slip.
- **`invariant.test.ts`:** alters exactly what it pins (login↔employee links);
  it's in the verification run.
- **Seed is destructive** (wipes all tables). Dev DB only.
- Existing suites are unaffected in principle — all backend tests mint their own
  `${TAG}-*` users/employees, none reference `tm-004` (VERIFIED §1.3) — but §4
  runs the full suite regardless.

---

## 6. Sequencing

1. Part A (seed) + §4 verification — one commit-sized unit, unblocks the dev
   account immediately.
2. Part B (comments) — independent, trivial, can ride along or follow.

No migrations, no API changes, no client changes anywhere in this plan.
