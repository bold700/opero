# WOB Isolatie — client feedback (17-07-2026)

Source: `WOB Isolatie (1).pdf`, dated 17-07-2026. Every item below was checked
against the actual codebase, not taken at face value. Status as of 22-07-2026,
after the implementation pass.

## Done in this pass

1. **Comments field position** — the werkomschrijving sat directly under the
   zone title, where the two fields read as one block. Moved BELOW the photo
   upload and given a visible label (`ZoneCard.tsx`).

2. **Technicians can no longer change the quoted work.** This was the real gap:
   `PATCH /tasks/:taskId`, `PATCH /materials/:matId` and `DELETE
   /materials/:matId` had no role check at all, so any assigned monteur could
   rewrite descriptions, change quantities/prices, or delete a quoted line —
   all of which feed `recomputeQuoteAmount()` and move the invoice. Now split
   FIELD BY FIELD (`work-orders/routes.ts`):
   - technician → `done`, `note`, `usedQuantity`, `onSite` (registration)
   - admin → + `description`, `day`, `workTypeId`, `assigneeId`, `name`,
     `unit`, `quantity`, `unitPrice`, `diameter`, `label`, `variantId` (scope)

   Adding and deleting lines is admin-only (`requireQuoteScopeEditor`). The
   monteur's channel for "this needed more than we sold" remains meerwerk,
   which the office prices and approves. Mirrored in the UI by splitting
   `canWrite` into `canWrite` / `canEditScope`.

3. **Custom / miscellaneous materials.** The backend already accepted free-text
   lines but the client never called it — `AddTaskLineDialog` was catalog-only.
   It now has a catalog/custom toggle: description + quantity + unit typed by
   hand, price admin-only. This also gave free-text lines an edit path; the
   pencil used to be hidden for them entirely.

4. **Materials edit affordance.** Quantity was click-to-edit whose only hint was
   a CSS cursor change — not discoverable, not keyboard-reachable. Now a real
   focusable button with a dotted underline and hover state; edit/delete icons
   are tooltipped.

5. **Auto-create a login when an employee is created.** `POST /employees` only
   created the Employee row. It now provisions an invited User and sends the
   invite (`users/provisioning.ts`, shared with the manual invite flow).
   Deliberately BEST-EFFORT — a taken email or a dead mail provider must not
   fail the employee create — and the outcome is reported in the response so
   the UI can say what happened. Always the `technician` role, never `admin`:
   TeamRole is a job title, not an access level.

6. **Work-order overview filters.** Was status chips + text search only. Added
   customer, monteur, work type and a planned-date range, plus
   `GET /work-orders/filter-options` for the dropdowns. Filters are ANDed as
   separate where-fragments (never spread — see the `projectScopeWhere`
   OR-clobber bug), and `customerId` is ignored for the `client` role so it
   can't be used to widen visibility.

7. **Vacation / absence per employee.** New `EmployeeAbsence` model with
   inclusive `YYYY-MM-DD` ranges and a kind (vacation/sick/training/other),
   admin CRUD under `/employees/absences`, and a management dialog on the
   Employees screen. Planning reads it: `/work-orders/assignable?date=`
   annotates absent staff (they stay listed — a missing name reads as "no
   longer employed"), and scheduling an absent team leader is refused with a
   message naming the person and period. The "not invoiced" half needed no
   subtraction (hours are logged per task, so absent days contribute nothing);
   instead the timesheet now reports `absentHours` when hours WERE logged on an
   absent day, since that means the two records disagree.

8. **Dead status enum removed.** `enum WorkOrderStatus` in `schema.prisma` was
   referenced by no model, and `shared/src/types.ts` mirrored it. Both declared
   a `completed` value the runtime never produces — the live column is
   `WorkOrder.listStatus` with `open | on_the_way | urgent | done`. This is
   almost certainly why status looked "not linked correctly". The Prisma enum
   is dropped; the shared type is renamed `MockWorkOrderStatus` (it is used
   only by the mock fixtures) with a comment pointing at the real one.

## Already worked — verified, no change needed

- **Status reaching "Completed"** — `deriveWorkOrderStatus()` returns `"done"`
  on `signedAt` first, and `recomputeWorkOrderStatus` runs on every mutation
  path. The reported symptom was the phantom `completed` enum above (#8).
- **Reopen a closed werkbon** — `POST /work-orders/:id/reopen`, admin-only,
  with a confirm dialog.
- **PDF upload on werkbons** — `WorkOrderAttachment` + `AttachmentsPanel`,
  PDF/JPEG/PNG/WebP. Office formats (docx/xlsx) are still rejected.
- **Photo expand on mobile** — `Lightbox.tsx`, tap-to-expand, viewport-sized.
  No pinch-zoom or swipe-between-photos yet.
- **Technician sees only their own werkbons** — enforced in the backend
  where-clause, 404 not 403.
- **Technicians cannot see prices** — stripped server-side per role, not merely
  hidden. The old `hidePricesFromTechnicians` org toggle was already dropped in
  migration `20260720120000`, so this is now absolute as the client asked.
- **Meerwerk free-text price** — already admin-gated on both create and update;
  an earlier draft of this doc claimed otherwise.

## Still open — needs input or is a separate project

- **KVK database check** — no integration exists, and `Customer` has no KVK
  field (the only `kvkNumber` is the org's own, on the settings form). Needs a
  real KVK API subscription + credentials before it's buildable.
- ~~**Silvasoft import via Excel**~~ — **BUILT** (23-07-2026). Admin uploads a
  Silvasoft "Export → Excel" customer file on the Customers screen; a preview
  shows create/update/skipped counts before anything is written, then commit
  upserts in one transaction. Re-import matches on Silvasoft's "Nummer"
  (`Customer.silvasoftId`) so it updates rather than duplicates, and never
  blanks a field the export left empty. KvK-nummer / BTW-nummer are captured
  into `Customer.kvkNumber` / `vatNumber` (the KvK one feeds the still-pending
  KVK-check feature). Parser: `backend/src/modules/customers/silvasoftImport.ts`;
  verified against the client's real 75-row export (72 imported, 3 junk rows
  skipped).
- **Request intake automation** ("can this process be partially automated?") —
  no inbound mail anywhere; the `Intake` model is a post-sale site survey, not
  a request inbox. Underspecified as written: needs the client to say what
  "automated" means (parse the email? create a draft customer/project for
  review?) before it can be scoped.

## Note on a contradiction in the source document

The PDF asks for both "technicians only need to register additional work, they
should not be able to change the original work" (Features) and "technicians
should be able to add or edit materials" (Technicians). These cannot both hold
for quoted task lines. Resolved as: technicians register usage and report
meerwerk freely; changing the quoted scope is office work. This matches the
client's separate instruction that a technician should not be able to add a
task. Flagged here so the decision is visible and reversible.
