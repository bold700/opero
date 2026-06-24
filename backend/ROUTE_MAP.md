# Opero API — Route Map (Phase 3)

Maps the Zustand store's action surface (`client/src/lib/store.ts`, ~146 keys) to the
REST endpoints that replace them. **115 routes** across 9 modules (105 domain + 10 auth).
Every domain route is `requireAuth`-gated; role/ownership rules per the spec matrix
(`@opero/shared` `PERMISSION_MATRIX`). All mutations run in a transaction with an
`audit_log` row; project mutations also append `project_activity`.

Legend: **A**=admin, **M**=monteur, **K**=klant. "own" = ownership/assignment scoped.

## Auth (`/api/auth`) — 10
login, login/2fa, refresh, logout, me, forgot-password, reset-password,
2fa/setup, 2fa/enable, 2fa/disable. (Phase 2.)

## Customers (`/api/customers`) — 13
| Method | Path | Roles | Store action |
|---|---|---|---|
| GET | `/` | A, K(own) | (customers state) |
| GET | `/:id` | A, K(own) | — |
| POST | `/` | A | addCustomer |
| PATCH | `/:id` | A, K(own) | updateCustomer |
| DELETE | `/:id` | A | removeCustomer (soft) |
| GET/POST/PATCH/DELETE | `/:id/contacts[/:contactId]` | A (read: K own) | spec Contact Persons |
| GET/POST/PATCH/DELETE | `/:id/locations[/:locationId]` | A (read: K own) | spec Locations |

## Employees (`/api/employees`) — 7
| GET `/` · GET `/:id` · POST `/` · PATCH `/:id` · POST `/:id/roles` · DELETE `/:id` | A | addTeamMember, updateTeamMember, toggleTeamMemberRole, removeTeamMember |
| GET `/:id/timesheet` | A, M(own) | spec Timesheet (aggregates WerkbonTaak.hours) |

## Materials (`/api/materials`) — 17
Materials/inventory: GET `/`, GET `/:id`, POST `/`, PATCH `/:id`, DELETE `/:id`,
PATCH `/:id/inventory` (A write; M read). Articles: GET/POST/PATCH/DELETE `/articles[/:id]`
(addArticle/updateArticle/removeArticle). Werksoorten: GET/POST/PATCH/DELETE
`/werksoorten[/:id]` (addWerksoort/renameWerksoort/removeWerksoort). Orders: GET `/orders`,
POST `/orders`, PATCH `/orders/:id/receive` (createPurchaseList/receivePurchaseList).

## Projects (`/api/projects`) — 33
CRUD: GET `/`, GET `/:id` (full nested, monteur price-stripped), POST `/` (createProject),
PATCH `/:id` (updateProject), DELETE `/:id` (deleteProject), POST `/:id/archive`.
Lifecycle: POST `/:id/status` (moveProjectToStatus), POST `/:id/stage`
(setStage/advanceStage), POST `/:id/materials/check` (moveToMaterialsCheck).
Intake: PATCH `/:id/intake` (updateIntake), POST `/:id/intake/complete` (completeIntake).
Quote: POST/PATCH/DELETE `/:id/quote/lines[/:lineId]`, POST `/:id/quote/from-catalog`
(addQuoteLineFromCatalog), POST `/:id/quote/apply-norm-prices` (applyNormPrices),
POST `/:id/quote/send` (sendQuote), POST `/:id/quote/accept` (acceptQuote; **K own**).
Status flags: POST `/:id/urgency` (setProjectUrgency), POST `/:id/resolve-blocker`,
POST `/:id/team` (setProjectTeam/toggleProjectInstaller).
Activity: GET `/:id/activity`, POST `/:id/comments` (addProjectComment; A/M-own/K-own).
Meerwerk: POST `/:id/meerwerk` (addMeerwerk; M-own may create), `/approve-office`,
`/approve-client` (K-own), `/reject`, `/toggle-done`.
Oplevering: `/oplevering/init`, `/items/:itemId/toggle`, `/photo`, PATCH `/restpunten`,
`/sign` (initOplevering/toggleOpleverItem/addOpleverPhoto/setRestpunten/signOplevering).

## Work Orders / Werkbonnen (`/api/work-orders`) — 25
The headline module; monteur "limited" write access concentrates here (assigned projects only).
GET `/`, GET `/:id` (price-stripped for M), POST `/` (createWerkbon/ensureWerkbon),
PATCH `/:id`, DELETE `/:id` (A only), POST `/:id/approve` (approveWerkbon),
POST `/:id/drawings` (addWerkbonDrawing).
Tasks: POST `/:id/tasks` (addWerkbonTask), PATCH/DELETE `/:id/tasks/:taskId`
(updateWerkbonTask/removeWerkbonTask), POST `/:id/tasks/reorder` (reorderWerkbonTasks),
POST `/:id/tasks/:taskId/toggle` (toggleWerkbonTask).
Timing: `/start` (startTask), `/end` (endTask, timer→hours), PATCH `/hours` (setTaakHours).
Photos: `/photos/before`, `/photos/result`, DELETE `/photos` (addTaak*Photo/removeTaakPhoto).
Materials: POST `/tasks/:taskId/materials` (addTaakMateriaal/addTaakRegel),
PATCH/DELETE `/materials/:matId` (updateTaakMateriaal/removeTaakMateriaal),
`/materials/:matId/usage` (setMateriaalUsage), `/materials/:matId/toggle` (toggleMateriaalDone).
Completion: POST `/:id/complete-all` (completeAllTaken), POST `/:id/finish` (afrondenWerkbon).

## Planning (`/api/planning`) — 6
GET `/` (calendar feed; A all, M own), GET `/route` (route overview),
POST `/projects/:id/planning` (schedulePlanningSlot/scheduleProjectOnDay),
PATCH `/projects/:id/planning/duration` (setProjectDurationDays),
DELETE `/projects/:id/planning` (unscheduleProject),
POST `/projects/:id/planning/mark-planned` (markProjectPlanned). K: none.

## Dashboard (`/api/dashboard`) — 1
GET `/` — role-aware payload (A full KPIs; M today's tasks+schedule; K status of own).

## Invoices (`/api`) — 3
POST `/projects/:id/invoice/draft` (createInvoiceDraft), `/send` (sendInvoice),
`/paid` (markInvoicePaid). A only.

---

### Store actions not exposed as endpoints (intentional)
- `setActiveProfile`, `resetDemo`, `setProjectsView`, `generateTasks`, `toggleTask`,
  `addExtraWork`, `addWorkOrderPhoto/Note`, `updateWorkOrderStatus`, `completeWorkOrders`,
  `completeDelivery`, `updateDeliveryItem` — these are legacy/UI-only store helpers or
  map onto the werkbon model (the old `WorkOrder` structure is superseded by werkbonnen).
- Profile switching is replaced by real auth (Phase 2). Demo reset is dev-only.
