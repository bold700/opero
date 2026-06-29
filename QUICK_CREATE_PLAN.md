# Quick-Create Menu (the "+" FAB) — Plan

Make the big **+** button in the nav rail actually do something: open a **quick-create
menu** listing everything the user can create (customer, employee, material, work order,
planning item…), filtered by their role. Picking one jumps to that feature and opens its
create dialog.

---

## 0. What exists today (audited)

- The **+** is a `<Fab>` in `client/src/app/AppShell.tsx` (`NavRail`, line ~103) with
  **no `onClick`** — purely decorative.
- Desktop = the left **nav rail** (`display: { xs: "none", md: "flex" }`). Mobile = a
  **bottom nav** (`display: { xs: "block", md: "none" }`) with **no add button** at all.
- **Every feature already has a working create dialog**, opened from that page's local
  state via an `openCreate()` → `setDialogOpen(true)` handler:
  - Customers → `CustomerDialog` (`createCustomer`)
  - Employees → `EmployeeDialog` (`createEmployee`)
  - Materials → `MaterialDialog` (`createMaterial`)
  - Work orders → `CreateWorkOrderDialog` (`create-api.ts`; handles the full
    customer → project → work order chain)
- **No page currently opens its dialog from a URL param** — only from its own button.
  This is the one gap the plan closes.
- Role gating lives in `@opero/shared` `PERMISSION_MATRIX` + the existing
  `navItemsForRole(role)` used by the rail.

**Key architectural fact:** the quick menu lives in `AppShell` (global), so it *cannot*
call a feature page's local `openCreate()`. The clean bridge is to **navigate to the
feature route with `?create=1`** and have each page auto-open its dialog when it sees that
param. Pages keep all their create logic; we add a tiny "open-on-param" effect.

---

## 1. The create actions to list

One entry per creatable thing, each with: icon, i18n label, target route, the roles
allowed, and (where relevant) the section it belongs to.

| Action | Route opened | Roles | Notes |
|---|---|---|---|
| New work order | `/work-orders?create=1` | admin, technician | The headline action — first in the list. Existing `CreateWorkOrderDialog`. |
| New customer | `/customers?create=1` | admin | |
| New employee | `/employees?create=1` | admin | |
| New material | `/materials?create=1` | admin | |
| New planning item | `/planning?create=1` | admin | Schedule a job. Confirm Planning has/should-have a create dialog (see §5). |

Materials sub-types (article / work-type / order) are **out of scope** for v1 — the menu
lists the primary "Material". Can add later if the client wants.

**Role filtering:** derive each item's visibility from `PERMISSION_MATRIX[section][role] !==
"none"` (or a small explicit `roles` array per item, mirroring `navigation.ts`). A
technician sees only "New work order"; a client sees nothing → the **+** hides entirely
for clients (or shows a disabled/empty state — lean: hide the FAB when the list is empty).

---

## 2. The menu UI

A single new component: `client/src/app/QuickCreateMenu.tsx` (one component, its own file).

- Anchored MUI `<Menu>` opened by the FAB (`anchorEl` state in `NavRail`), same pattern the
  avatar menu in `AppShell` already uses (`setAnchor`).
- Each row: `<MenuItem>` with `<ListItemIcon>` (feature icon) + `<ListItemText>` (label).
- Group/order: work order first (primary action), then the rest. Optional small section
  label ("Create").
- On click: `navigate(route)` + close the menu. The destination page opens its dialog.
- Reuse design tokens; no magic numbers. Sentence-case labels via i18n.

**Config-driven:** a `QUICK_CREATE_ACTIONS` array (like `navigation.ts`) holding
`{ key, labelKey, icon, route, roles }`. The menu maps over it filtered by role. New
creatables later = one array entry.

---

## 3. Make each page open its dialog on `?create=1`

For each feature page (Customers, Employees, Materials, WorkOrders, Planning):

- Read the param with `useSearchParams()`.
- On mount / when the param flips to `1`, call the existing `openCreate()` and then
  **clear the param** (`setSearchParams({}, { replace: true })`) so a refresh or back-nav
  doesn't reopen the dialog.
- This is ~4 lines per page; no change to the dialogs themselves.

```ts
const [params, setParams] = useSearchParams();
useEffect(() => {
  if (params.get("create") === "1") {
    openCreate();
    setParams({}, { replace: true });
  }
}, [params, openCreate, setParams]);
```

(Guard `openCreate` with `useCallback` where needed to keep the effect stable.)

---

## 4. Wire the FAB (desktop) + add a mobile entry

- **Desktop:** give the existing `<Fab>` an `onClick` that opens `QuickCreateMenu`
  (anchored to the FAB).
- **Mobile:** the bottom nav has no add button. Add a centered **+** action (either a
  `BottomNavigationAction` or a small FAB above the bar) that opens the same menu. Keeps
  the monteur's "new work order" reachable one-handed on a phone.
- If the role has zero create actions (client), hide the FAB / mobile add entirely.

---

## 5. One thing to confirm during build

**Planning create flow.** Customers/Employees/Materials/WorkOrders have confirmed create
dialogs. Planning's `api.ts` posts to `/planning/projects/:projectId/planning` — i.e. a
planning item is scheduled *against an existing project*, and the calendar may create via
a different interaction (click a slot). Two options:
- **(a)** If Planning has a usable "new planning item" dialog, point `?create=1` at it.
- **(b)** If not, either omit Planning from the menu for v1, or make "New planning item"
  navigate to `/planning` and trigger its existing "schedule" affordance.

Decide when wiring §3 for Planning; don't block the other four on it.

---

## 6. i18n

Add a `quickCreate` namespace (NL + EN): menu heading + one label per action
(`quickCreate.workOrder`, `.customer`, `.employee`, `.material`, `.planning`). English
keys, Dutch + English display values. No Dutch in code.

---

## 7. Verification

- `tsc --noEmit` + `vite build` green.
- Manual-equivalent via code: each page opens its dialog when visited with `?create=1`,
  and the param is cleared afterward.
- Role check: log in as technician → menu shows only "New work order"; as client → FAB
  hidden. (Verify with the seeded demo accounts.)
- No regression: existing per-page create buttons still work.

---

## 8. Build order

1. `QUICK_CREATE_ACTIONS` config + `QuickCreateMenu.tsx` component.
2. Wire the desktop FAB `onClick` → menu. Hide when empty for the role.
3. Add `?create=1` auto-open effect to the 4 confirmed pages (Customers, Employees,
   Materials, WorkOrders).
4. Mobile add entry in the bottom nav → same menu.
5. Planning (per §5 decision).
6. i18n NL + EN.
7. Verify (§7).

---

## Out of scope (v1)
- Materials sub-types (article / work-type / purchase order) in the menu.
- Keyboard shortcut to open quick-create (nice-to-have later).
- "Recently created" or smart ordering.
