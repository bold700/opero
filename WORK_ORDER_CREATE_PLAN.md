# Work Order: where each field is set — corrected model

## The realization

A **work order** is the job at one site. Its **tasks are the zones** (front wall, basement
floor, crawl space). Each zone is a distinct piece of work — so the fields that vary by zone
belong on the **task**, not the project:

- **Work type → per task.** Each zone is a type of work (front wall = spouwmuurisolatie, floor
  = vloerisolatie). One-type-per-project is wrong — that's exactly why demo data had mushy
  combined strings ("Kruipruimte en bodemfolie"): two work types crammed in one field with
  nowhere else to go.
- **Technician → per task.** Different people do different zones.
- **Location → per work order** (the job site). One site per work order; not re-picked per zone.

And **when**: set while **building out the tasks in the work-order detail** — add a task, then
say what it is and who does it. NOT crammed into a create dialog before the work order exists.

So the create dialog goes back to **minimal** (customer + project + location), and work type +
technician become **task fields edited in the detail screen**.

## Field placement (final)

| Field | Level | Where set |
|---|---|---|
| Customer | Project | create dialog |
| Location (site) | Project | create dialog |
| **Work type** | **Task** | work-order detail, per task |
| **Technician** | **Task** | work-order detail, per task |
| Title (optional) | Work order | create dialog |
| #, Status, Date | system | auto/derived |

## What this changes vs. what I already built

Phase 1 (managed `WorkType` list + `Project.workTypeId`) stays — the managed list is still the
source of the dropdown. But the *link* moves: the FK goes on the **task**, and `Project`'s work
type becomes a derived rollup (or is dropped from the create dialog). I will:
- **Keep** `WorkType` table + `Project.workTypeId` (a project can still have a "primary" type,
  but it's no longer the per-zone truth and is no longer required at create).
- **Remove** work type + technician from the create dialog (revert Phase 2's dialog additions
  for those two; keep Location).

---

## THE PLAN

### Phase A — Task gets work type + technician (schema)
- `WorkOrderTask`: add `workTypeId String?` (FK → `WorkType`) and `assigneeId String?`
  (FK → `Employee`). Both nullable. Migration.
- Relations + back-relations on `WorkType` and `Employee`.

### Phase B — Backend: set/read them per task
- `updateTaskSchema`: accept `workTypeId` + `assigneeId`; validate both belong to the org.
- `PATCH /work-orders/:id/tasks/:taskId` writes them; task DTO returns `workTypeId`/
  `workTypeName` + `assigneeId`/`assigneeName`.
- **List rollup**: `workOrderListDto` "Work type" + "Technician" columns derive from the
  work order's tasks — e.g. the distinct task work types (joined) and distinct assignees,
  rather than `project.insulationType` / `project.teamLeader`. Falls back to "—" when unset.
- **Assignable-people endpoint** technicians can read: `GET /work-orders/:id/assignable`
  (or reuse an existing employees-lite list) returning `{id, name}` field staff — because the
  employees list is admin-only but technicians work the detail screen.
- Work-type list endpoint already exists (`GET /materials/work-types`).

### Phase C — Frontend: per-task editing in the detail
- In `TasksPanel`, each task row gains:
  - a **work-type dropdown** (from `GET /materials/work-types`),
  - an **assignee dropdown** (from the assignable-people endpoint).
- Wire both to `PATCH .../tasks/:taskId`. Respect roles (technician can edit on assigned work;
  never sees prices — unaffected here).
- Revert the create dialog: drop the work-type + technician fields (keep Customer, Project,
  Location, Title).

### Phase D — Cleanup
- The work-order list now reflects per-task reality. Confirm the columns read sensibly when a
  work order mixes types/people ("Spouwmuur +1", or list the distinct values).
- Keep `Project.workTypeId` as an optional project-level "primary type" (set later if useful),
  not required.

---

## Order
A (schema) → B (backend set/read + rollup + assignable endpoint) → C (per-task UI + revert
dialog) → D (list polish). Each verified with tsc + vite build + vitest + curl. No browser
tests. No auto-commit.

## Rules
English internals, Dutch display-only via i18n. Work-type names are managed data (admin types
them), not i18n keys. Technician never sees prices; client sees own data only. Mutations
transactional + audit-logged.
