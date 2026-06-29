# Settings — finish EVERYTHING, end to end (production)

Status: **Profile ✅, Company ✅.** This plans the rest so **all 4 tabs fully
save**: Notifications, Preferences (language + show-prices), with roles enforced
and language persisted **server-side per user** (follows the user across devices).

---

## Final state of every control (the checklist)

| Tab | Control | Scope | Saves where | View / Edit |
|---|---|---|---|---|
| Profile ✅ | name / email / phone | per-user | `User` (done) | own / own |
| Company ✅ | name/email/address/postal/city/phone/VAT | org | `Organization` (done) | admin / admin |
| **Notifications** | 4 toggles (newWorkOrder, urgentOnSite, extraWorkApproval, weeklySummary) | per-user | `User.preferences` JSON | own / own |
| **Preferences → language** | nl / en | **per-user (server)** | `User.preferences` JSON | own / own |
| **Preferences → show prices to technicians** | toggle | **org** | `Organization.hidePricesFromTechnicians` (col exists) | admin / admin |

Per-user prefs (notifications + language) live in **one `User.preferences` JSON
column**, behind **one** endpoint. The org show-prices flag already has its
column (added in the Company phase).

---

## Roles (enforced both sides)
- **Notifications + language**: any authed user, **own** prefs only. Backend keys
  off `req.user.id` — a user can only ever read/write their own.
- **Show-prices toggle**: **admin only** (it's an org setting). Backend
  `requireRole("admin")` on the org PATCH (already there); the toggle is **hidden
  for non-admins** in the UI (it lives in the privacy group; render it only for
  admins).
- Settings nav already filters Company to admins.

---

## THE PLAN

### Phase A — per-user preferences (backend)
- **Migration:** add `User.preferences Json?` — shape:
  `{ language?: "nl"|"en", notifications?: { newWorkOrder, urgentOnSite, extraWorkApproval, weeklySummary: boolean } }`.
- **Include `preferences` in the user DTO** (`toAuthUser`) with sane defaults
  (language from existing value or "nl"; notifications all-on except
  weeklySummary) so the client always gets a complete object.
- **`PATCH /auth/preferences`** (requireAuth, own): accepts a partial
  `{ language?, notifications? }`, merges into the stored JSON, returns the
  updated user. Audit-logged.

### Phase B — Notifications tab (wire it)
- **`ToggleRow`** → make it controllable: add `checked` + `onChange` props
  (keep `defaultChecked` fallback for the old call sites... actually convert
  call sites). 
- **`NotificationsForm`** → read the 4 booleans from `user.preferences.notifications`,
  toggle locally, **save on change** (debounced) or via a Save button →
  `PATCH /auth/preferences { notifications }`, then `setUser(updated)`.
- *Honest note:* this stores the preference; **delivery (email/push) isn't built
  yet** — that's the email/M3 phase. Label stays as-is; it's a real saved pref
  the future delivery layer will read.

### Phase C — Language (per-user, server-persisted, multi-device)
- **Preferences form:** the language `<select>` becomes controlled by
  `user.preferences.language`. On change:
  1. `i18n.changeLanguage(value)` (instant UI switch + existing localStorage),
  2. `PATCH /auth/preferences { language: value }` + `setUser(updated)` (server
     persistence so it follows the user to other devices).
- **Apply on login / refresh:** in `AuthContext`, after `/auth/me` (or login)
  resolves, if `user.preferences.language` is set and differs from the current
  i18n language, call `i18n.changeLanguage(it)`. So a user logging in on a new
  device gets their saved language, not the device default.
- Net: localStorage = fast device cache; `User.preferences.language` = source of
  truth that syncs across devices. **They match** because login reconciles them.

### Phase D — Show-prices toggle (org, admin-only) ★ the Kenny one
- **`canSeePrices`** in shared: change signature to
  `canSeePrices(role, hidePricesFromTechnicians)`:
  - admin / client → always `true`.
  - technician → `true` only if `!hidePricesFromTechnicians`.
  (Default stays "hidden" to preserve today's behavior.)
- **Thread the org flag** into every DTO that strips prices — currently they call
  `canSeePrices(role)`. Each needs the org's `hidePricesFromTechnicians`:
  - `work-orders/dto.ts` (taskMaterial unitPrice), `projects/dto.ts` (value,
    quote, invoice, extraWork amounts), `materials` (if any price), `reports`,
    `dashboard` (pipeline value).
  - Load the flag once per request (from `req.user.orgId` → org row, or include
    in the loaded project/org) and pass it down. Cleanest: a tiny helper
    `getOrgPriceVisibility(orgId)` cached per request, or include
    `org: { hidePricesFromTechnicians }` in the relevant queries.
- **Preferences form:** the privacy `ToggleRow` (admin-only) reads
  `organization.hidePricesFromTechnicians`, flips it via `PATCH /organization`.
  Hidden entirely for non-admins.
- **Verify with a technician token:** flipping the flag actually changes whether
  prices appear in the work-order / project DTOs.

---

## Build order
1. **A** — `User.preferences` migration + DTO + `PATCH /auth/preferences`.
2. **B** — Notifications wired.
3. **C** — Language: controlled select + save + apply-on-login.
4. **D** — Show-prices: rework `canSeePrices`, thread the org flag through all
   DTOs, wire the admin toggle, prove with a technician token. (Biggest blast
   radius — do last, test hard.)

## Rules
- English internals; NL/EN via i18n. Enum/role values internal, labels
  translated.
- Per-user prefs gated to `req.user.id`; org settings + show-prices gated to
  `requireRole("admin")` server-side, hidden client-side. Defense in depth.
- Technician never sees prices unless the org flag explicitly allows it; no price
  leakage through any DTO.
- Every mutation transactional + audit-logged.
- Verify each phase: tsc + vite build + curl. For D, a **technician-token test**
  proving DTO prices toggle with the flag. No browser tests. No auto-commit.
