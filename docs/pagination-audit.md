# List pagination — audit + implementation

**Original audit:** 2026-07-04 · **Implemented:** 2026-07-05
**Scope:** Every "list" screen — Work orders, Customers, Employees, Materials, Users, Projects.

## The problem (before)

Nothing was paginated. Every list endpoint did an unbounded `prisma.X.findMany({ where, orderBy })` and the client fetched + rendered the entire table at once (`ResponsiveList` mapped every row). Filtering/search/counts were computed client-side over the full in-memory array. Fine for tiny data; a real scalability problem as work orders (the one unbounded-growth table) pile up over years — heavy payloads and thousands of DOM nodes, worst on mobile.

## What was built (industry-standard)

**Every list now paginates**, ~20 rows/page, with server-side search + filter + counts. Same UX on mobile and desktop: infinite scroll (an `IntersectionObserver` sentinel) with a visible **"Load more"** button as the honest fallback.

### Shared plumbing
- **Backend** — `backend/src/lib/pagination.ts`: `parsePageParams(req)` (reads `?limit` default 20 / cap 100, `?cursor`, `?search`) + `paginate(params, queryFn)` → `{ items, nextCursor }`. **Cursor-based** (not offset), so constant inserts on a `createdAt desc` list don't cause skips/repeats. Every list's `orderBy` ends in `{ id: … }` and the cursor is the row id.
- **Client** — `api.getPage<T>()` returns `Page<T> = { items, nextCursor }`; `api.getAll<T>()` drains all pages for **selector/picker** data sources only (project & customer dropdowns in the werkbon-create flow, planning board). `usePagedApi<T, Meta>(fetchPage, deps)` accumulates pages, exposes `loadMore`/`hasMore`/`loadingMore` and `meta` (the whole-set `counts`); resets to page 1 when `deps` change (debounced search / active filter / reloadKey). `useDebounced` throttles the search box (300ms). `ResponsiveList` gained the load-more footer.

### Denormalized statuses (the subtle part)
Two lists filter/count on a status that is **derived**, not a column, so a denormalized column was added and kept in sync at every mutation boundary (single recompute helper, not scattered writes) + backfilled by migration `20260704000000_paginate_list_status`:
- **`WorkOrder.listStatus`** (`open|on_the_way|urgent|done`) — derived from project urgency + task completion. Synced via `recomputeWorkOrderStatus` in `reloadWorkOrder` (every WO mutation funnels through it) + `recomputeWorkOrdersForProject` at each project-urgency write in `projects/routes.ts`.
- **`Material.stockStatus`** (`ok|low|out_of_stock`) — derived from inventory qty vs reorder point. Synced via `recomputeMaterialStock` at every inventory write.

### Per-list specifics
| List | Search fields | Filter param | Counts |
|---|---|---|---|
| Work orders | title, project number/customer/city | `status=open\|on_the_way\|urgent\|done` | total + per-status |
| Customers | name, city, contact, email | `filter=business\|private` | total, business, private |
| Materials | name, category, supplier | `filter=ok\|low\|out_of_stock` | total + per-status |
| Employees | name, email, phone | `filter=technicians\|office\|inactive` | total, active, on_leave, inactive, technicians, office |
| Users | name, email | `filter=active\|invited\|disabled` | — (no count pills) |
| Projects | number, name, customer, city, address | — | — (selector-backed; no list screen) |

Global search (`GET /search`) was already capped and is unchanged.

## Verification
- `tsc --noEmit` clean across shared/backend/client; `vite build` clean.
- Backend suite: **57 passing**, including a new `work-orders/pagination.test.ts` that walks the cursor (every row once, no skips/repeats), checks whole-set counts, and proves the `listStatus` denormalization stays in sync (toggle a task done → column flips → `?status`/counts reflect it). Existing role-access + provisioning tests updated to read `body.items`.

## Notes / follow-ups
- Selector dropdowns (project/customer pickers) use `api.getAll` (drains pages, `maxPages` safety cap). If those source tables ever grow large, convert them to a proper async-search picker rather than draining everything.
- Employee "technicians"/"office" KPI counts now use the server's authoritative role-based definitions (roles include "Technician" / roles intersect office set), replacing the old client-side `function`-field heuristic.
