# Notifications / Bell — Comprehensive Plan

Make the dead 🔔 bell in the dashboard top bar real: a badge with a count of things that
need the user's attention, and a dropdown listing them, each linking to where to act.

---

## 0. What exists today (audited)

- **Bell UI:** `client/src/features/dashboard/components/DashboardActions.tsx` — a `Badge
  badgeContent={0}` (hardcoded) around a bell icon, **no `onClick`**. Dead.
- **Event system already exists:** `appendActivity(tx, user, projectId, type, messageKey, params)`
  is called at ~20 sites (project created/stage/status, quote sent/accepted, extra-work
  reported/approved/rejected, work order created/signed/dispatched, materials, etc.). But it's
  **project-scoped activity**, not per-user "you need to do X".
- **The dashboard already computes the actionable signals per role** (`modules/dashboard/routes.ts`):
  `urgentCount`, `blockedCount`, `readyToInvoice`, per-technician `openTaskCount` /
  `assignedProjectCount`. So "what needs attention" is mostly assembling queries that already exist.
- **Notification toggle preferences already exist** (`NotificationPrefs`: `newWorkOrder`,
  `urgentOnSite`, `extraWorkApproval`, `weeklySummary`) — per-user, server-persisted. These
  should GATE which notification categories a user sees.
- **Extra-work approval state** is on `ExtraWork` (`approvedByOffice`, `approvedByClient`,
  `rejected`) — the canonical "awaiting approval" signal.
- **Role visibility helpers** (`visibleProjectsWhere`, customer scoping) already enforce who sees
  what — reuse them so notifications never leak.

---

## 1. Design decision — derived action feed + per-user "last seen"

**Not** a full per-user `Notification` table (would mean adding write fan-out to ~20 event sites,
deciding recipients per event, backfill, and it duplicates the toggle prefs). Instead:

**A derived "action items" feed** — computed live from existing data — **plus one tiny per-user
`notificationsSeenAt` timestamp** so the badge can show "N items newer than your last look."

Why this is the right call:
- Accurate + always current (no stale rows when the underlying thing is resolved).
- Zero changes to the 20 event-write sites; no fan-out logic.
- Reuses the role-scope helpers → automatically permission-safe.
- Respects the existing notification toggles (each category maps to a pref).
- A "last seen" marker gives a real unread **count** without per-row read tracking.

Trade-off (accepted): no per-item "mark this one read" or notification history. If the client
later wants a true inbox with history, we add the `Notification` table then — this feed becomes
its query source. Documented as out of scope.

---

## 2. What counts as a "notification" (per role, gated by prefs)

Each item = `{ key, messageKey, params, createdAt, route, category }`. `category` maps to a
`NotificationPrefs` toggle; if the user disabled that toggle, the category is omitted.

| Category (→ pref) | Who | Signal (existing data) | Route |
|---|---|---|---|
| **extraWorkApproval** | admin | ExtraWork where `approvedByOffice=false && !rejected` (awaiting office) | work order / project |
| **extraWorkApproval** | client | ExtraWork where `approvedByOffice=true && approvedByClient=false && !rejected` (awaiting client) | work order |
| **urgentOnSite** | admin, technician (assigned) | Projects where `urgency ∈ {urgent, blocked}` (uses dashboard's urgent/blocked query) | work orders (filtered) |
| **newWorkOrder** | technician | Work orders assigned to them created since `notificationsSeenAt` (or recent) | `/work-orders/:id` |
| *(weeklySummary is email-only — not a bell item; leave out of the feed)* | | | |

Ordering: most recent / most urgent first. Cap total at ~15, with a "+N more" hint. Each item
carries a `messageKey` + `params` so the client renders Dutch/English via i18n (same pattern as
the activity log). English keys only.

---

## 3. Backend

### 3a. Schema
- Add `User.notificationsSeenAt DateTime?` (nullable). Migration (hand-written SQL, matches the
  repo convention). No other schema change.

### 3b. Endpoints (new module `modules/notifications/routes.ts`, mounted `/api/notifications`)
- `GET /notifications` → `{ items: NotificationItem[], unreadCount: number, seenAt }`.
  - Build the feed by role (see §2), reusing `visibleProjectsWhere` etc.
  - Filter categories by the caller's `NotificationPrefs` (from `req.user.preferences`).
  - `unreadCount` = items with `createdAt > (notificationsSeenAt ?? epoch)`.
  - `take` a sensible cap (e.g. 15); note if capped.
- `POST /notifications/seen` → sets `User.notificationsSeenAt = now()`, returns `{ seenAt }`.
  Called when the user opens the bell → badge clears.
- Both `requireAuth`. DTO returns only safe fields; no prices (notifications are counts/labels,
  not money — but if any label could include an amount, run it through the price rules).

### 3c. NotificationItem shape (shared type in `@opero/shared` or the module)
```ts
type NotificationItem = {
  id: string;            // stable-ish key (e.g. `extrawork:${id}` )
  category: "extraWorkApproval" | "urgentOnSite" | "newWorkOrder";
  messageKey: string;    // i18n key, e.g. "notifications.extraWorkAwaitingClient"
  params?: Record<string, unknown>;
  createdAt: string;     // ISO — for unread comparison + display
  route: string;         // where clicking takes you
};
```

### 3d. Performance
- A few small `findMany`/`count` in `Promise.all`, each scoped + `take` capped. Same cost profile
  as the dashboard endpoint (which already runs these). Fine for the data sizes.

---

## 4. Client

### 4a. API — `client/src/lib/api/notifications.ts`
`getNotifications()` → `{ items, unreadCount, seenAt }`; `markNotificationsSeen()` → POST /seen.

### 4b. Bell component — `client/src/features/dashboard/components/NotificationsBell.tsx`
- Replaces the dead bell in `DashboardActions`.
- On mount (and on an interval / focus refetch — keep simple: fetch on mount + when opened),
  load `getNotifications()`; show `unreadCount` in the `Badge` (hide badge when 0).
- Click bell → open a dropdown (same inline/anchored pattern we settled on — anchor to the bell,
  or a small popover styled like the search/quick-create menus: soft shadow, hairline, lavender
  hover). On open → call `markNotificationsSeen()` so the badge clears, and refetch or optimistically
  zero the count.
- Each row: category icon + rendered message (`t(item.messageKey, item.params)`) + relative time
  ("2h ago"). Click → navigate to `item.route` + close.
- States: loading (spinner), empty ("You're all caught up"), error (inline). Empty state matters —
  most of the time there's nothing, and that should feel calm, not broken.
- Role-aware automatically (backend already filtered).

### 4c. i18n
New `notifications` namespace (NL + EN): `title`, `empty`, message keys per item
(`extraWorkAwaitingOffice`, `extraWorkAwaitingClient`, `urgentProject`, `newWorkOrderAssigned`,
etc. with `{{...}}` params), relative-time words if not using a lib. English keys, Dutch + English
values.

---

## 5. Respecting the toggles (the loop closes)

The notification **preferences** we already built (Settings → Notifications) now actually do
something: the feed omits any category whose toggle is off. E.g. a monteur who turned off
"new work order" notifications won't get those bell items. This makes the existing toggles real
instead of decorative — a nice bonus.

---

## 6. Verification (curl + e2e, no browser)

- **admin:** report extra work on a project → `GET /notifications` shows an
  `extraWorkApproval` item (awaiting office); approve it → item disappears next fetch.
- **client:** after office approves, the client's feed shows "awaiting your approval".
- **technician:** urgent/blocked assigned project → `urgentOnSite` item; a work order assigned to
  them → `newWorkOrder` item. A customer-scoped item never appears.
- **prefs gating:** turn off `extraWorkApproval` pref → that category vanishes from the feed.
- **unread + seen:** unreadCount > 0 before `/seen`; `POST /seen` → unreadCount 0 on next fetch.
- **cross-org isolation:** never see another org's items.
- `tsc` (shared/backend/client) + `vite build` + full `vitest` green. Add an integration test for
  the feed + seen flow (local, no external deps). Clean up any test data.

---

## 7. Build order

1. Schema: `User.notificationsSeenAt` + migration + regenerate.
2. Shared `NotificationItem` type + category→pref map.
3. Backend `notifications` module: `GET /` (role-scoped, pref-gated feed) + `POST /seen`. Mount it.
   curl-verify all the §6 role/pref/unread cases.
4. Client `lib/api/notifications.ts`.
5. `NotificationsBell` component (badge + dropdown + states) → replace the dead bell.
6. i18n NL + EN.
7. Verify (§6) + integration test + cleanup.

---

## 8. Open questions (small — sensible defaults chosen)

1. **Refetch cadence:** v1 = fetch on mount + on bell-open (+ maybe a 60s poll). No websockets
   (out of scope; the app has no realtime layer). Default: mount + open + 60s poll.
2. **Where the bell lives:** currently dashboard-only (in `DashboardActions`). Could move
   app-wide (into the nav rail) later — the component is self-contained, so promoting it is easy.
   Default: dashboard for v1, matching where the icon is.
3. **"newWorkOrder" window:** since there's no per-item read state, "new" = assigned work orders
   created after `notificationsSeenAt` (fallback: last 7 days). Confirm during build.

---

## Out of scope (v1)
- Persistent `Notification` table with per-item read/unread + full history (add later if wanted;
  this feed becomes its source).
- Realtime push / websockets / service-worker web-push.
- Email/mobile-push delivery of these (that's the M3 email work + a future push layer).
- Weekly summary as a bell item (it's an email digest by design).
