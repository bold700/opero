# Dashboard Search — Plan

Make the dead 🔍 icon in the dashboard top bar open a real **global search**: type a
query, get grouped results (customers, work orders, projects), click one to jump to it.

---

## 0. What exists today (audited)

- The search icon lives in `client/src/features/dashboard/components/DashboardActions.tsx`
  as an `IconButton` with **no `onClick`** (dead). It's only on the **dashboard**, not app-wide.
- **No search endpoint exists** on the backend.
- **Role visibility is already enforced server-side** via reusable `where` helpers:
  - Projects: `visibleProjectsWhere(user)` (`modules/projects/visibility.ts`) — admin: all;
    client: own customer; technician: assigned.
  - Customers: `assertCanRead` / role-scoped where (`modules/customers/routes.ts`) — technician
    has no customer access; client sees only their own.
  - Work orders: list query already joins project + applies the project scope.
  → **Any search endpoint that reuses these helpers is automatically permission-safe.**

**Decision:** build a **real server-side endpoint** (not client-only filtering). It searches the
whole DB (org-scoped, role-filtered), so it finds things that aren't loaded on the current screen
— which is what "search" should do. Client-only filtering would only see one page's data.

---

## 1. Backend — `GET /search?q=`

New module `backend/src/modules/search/routes.ts`, mounted at `/api/search`.

- **Auth:** `requireAuth`. Reuses the same scope helpers as the list endpoints, so results are
  already filtered to what the user may see. No new permission logic.
- **Query:** `q` (string, min 2 chars; <2 → empty result, no DB hit). Trim + lowercase for matching.
- **Scope:** always `orgId = user.orgId` + `deletedAt: null`, AND the role `where` per entity.
- **Entities + fields searched** (case-insensitive `contains`):
  | Entity | Fields | Roles that get results |
  |---|---|---|
  | Customers | name, city, contactName, email | admin, client (own only); technician: none |
  | Projects | projectNumber, name, customerName, city, address | admin; client (own); technician (assigned) |
  | Work orders | project.projectNumber, project.customerName, project.city, title | admin; technician (assigned); client (own) |
- **Limits:** top **5 per entity** (`take: 5`), ordered by best/most-recent (e.g. `createdAt desc`
  or name asc). Keeps it fast and the dropdown short. Note in the response if a group was capped
  (so the UI can show "more…").
- **Response shape** (flat, grouped client-side or pre-grouped):
  ```ts
  {
    customers: [{ id, label, sublabel }],   // label=name, sublabel=city
    projects:  [{ id, label, sublabel }],   // label=projectNumber + name, sublabel=customer · city
    workOrders:[{ id, label, sublabel }],   // label=number + title, sublabel=customer · city
  }
  ```
  Each result carries enough to render a row + a **route to navigate to** (derived client-side
  from id: `/customers` (or detail), `/work-orders/:id`, etc.).
- **DTO:** a thin `searchResultDto` per entity — never leak internal columns or prices.
- **Perf:** three small `findMany` in `Promise.all`, each `take: 5`. Indexed on orgId already.
  Fine for the data sizes here; can add Postgres trigram/`pg_trgm` later if needed (out of scope).

---

## 2. Client — search API + types

In a small `client/src/lib/api/search.ts` (shared, not feature-local, since search may go app-wide later):

```ts
export type SearchHit = { id: string; label: string; sublabel?: string };
export type SearchResults = { customers: SearchHit[]; projects: SearchHit[]; workOrders: SearchHit[] };
export function search(q: string): Promise<SearchResults> { return api.get(`/search?q=${encodeURIComponent(q)}`); }
```

---

## 3. Client — the search UI (command-palette dropdown)

New component `client/src/features/dashboard/components/SearchMenu.tsx` (one component, its own
file). Or, if we want it reusable app-wide later, put it in `client/src/components/`. Start in
dashboard; promote if reused.

Behaviour:
- Click the 🔍 icon → opens a **popover/anchored panel** below the icon with a text input
  auto-focused. (MUI `Popover` or a `Menu` with a search field on top.)
- **Debounced** query (~250ms) → calls `search(q)`; show a spinner while loading.
- Results grouped by entity with a small section header each (Customers / Projects / Work orders).
  Each row: icon + label + muted sublabel. Empty groups hidden.
- **Click a row → navigate** to its destination and close (work order → `/work-orders/:id`;
  project → its detail or `/work-orders` filtered; customer → `/customers`).
- States: idle (prompt "Type to search…"), <2 chars (same), loading (spinner), no results
  ("No matches"), error (inline).
- **Keyboard:** arrow up/down to move through results, Enter to open the highlighted one, Esc to
  close. (Nice-to-have; can ship v1 with click-only and add keys after.)
- Role-aware automatically — the backend already returns only permitted results, so a technician
  simply gets no customer group.

Styling: match the app's M3 card language (same as the quick-create menu — soft shadow, hairline
border, lavender hover, purple icons). Reuse `CARD_SHADOW`, `RADIUS`, `LAVENDER` tokens.

---

## 4. Wire the icon

In `DashboardActions.tsx`: add anchor state, give the `IconButton` an `onClick` that opens
`SearchMenu` anchored to it. Same controlled-anchor pattern as the quick-create menu and the
profile menu.

---

## 5. i18n

New keys (NL + EN) under a `search` namespace (or extend `dashboard.actions`):
`placeholder` ("Search customers, work orders…"), `groups.customers/projects/workOrders`,
`empty` ("No matches"), `hint` ("Type to search"), `more` ("+{{n}} more"). English keys, Dutch +
English values.

---

## 6. Verification

- `tsc` (backend + client) + `vite build` green.
- **curl / e2e against the running API with the seeded accounts:**
  - admin search "peet" → returns the Peeters customer + related projects/work orders.
  - technician search for a customer name → **no customer group** (they can't see customers),
    but their assigned work orders/projects still match.
  - client search → only their own customer's projects/work orders.
  - `q` < 2 chars → empty, no DB error.
  - cross-org: a user can't find another org's records (orgId scope).
- Clean up any test data created (there shouldn't be — search is read-only).

---

## 7. Build order

1. Backend `search` module + `searchResultDto` + mount at `/api/search`. curl-verify role scoping.
2. Client `lib/api/search.ts`.
3. `SearchMenu` component (input + debounce + grouped results + navigate).
4. Wire the dashboard 🔍 `onClick`.
5. i18n NL + EN.
6. Verify (§6).

---

## Open questions (small — can default)

1. **Result click destinations:** customers/projects don't have dedicated detail *pages* yet
   (customers is a list with an edit dialog; projects surface via work orders). For v1, lean:
   - work order → `/work-orders/:id` (real detail page ✅)
   - customer → `/customers` (list; could pre-filter by the name later)
   - project → `/work-orders` filtered to that project, or its first work order.
   Confirm during build; default to "navigate to the closest existing screen."
2. **App-wide vs dashboard-only:** ship on the dashboard first (where the icon is). If you want
   it everywhere, the same `SearchMenu` can later move into the nav rail / a global shortcut
   (Cmd-K) — out of scope for v1.

---

## Out of scope (v1)
- Fuzzy/trigram ranking, typo tolerance (`pg_trgm`) — exact `contains` is enough now.
- Searching materials, employees, planning items — add later if wanted (employees are admin-only;
  easy to extend the endpoint).
- Cmd-K global shortcut / app-wide placement.
- Recent searches / history.
