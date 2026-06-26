# Werkbonnen (Work Orders) — Full End-to-End Plan

Every button, every action, the complete create → execute → approve → finish lifecycle.
The backend already supports almost all of it (25 work-order routes + project routes); the
frontend uses almost none of it. This plan wires the WHOLE flow.

---

## Reality check — what's on the page now and what works

### Werkbonnen LIST page (`/work-orders`)
| Element | Today |
|---|---|
| 🔍 Search "Zoek op nummer of klant" | **dead** (no handler) |
| ⭐ Favorites star icon | **dead** (no handler) |
| **+ Nieuwe werkbon** button | **DEAD** — can't create anything |
| Filter chips (Alle/Open/Onderweg/Spoed/Klaar) | works (client-side filter) |
| Table row / 👁 eye action | navigates to detail (just built) |
| Pagination | removed earlier; list shows all |

### Werkbon DETAIL page (`/work-orders/:id`) — partially built
| Panel | Today |
|---|---|
| Tasks panel | **read-only** (shows tasks, can't add/edit/complete) |
| Extra-work approval | works (report → office → client → audit) ✅ |
| Activity / audit trail | works ✅ |
| Sign-off (signature → finish) | **not surfaced** (API call scaffolded, no button) |
| Photos | **placeholder** (disabled — needs Phase: file storage) |

### What the BACKEND already supports (unused by the UI)
Create work order, edit title, approve (supervisor), add/edit/reorder/delete tasks, toggle task
done, start/stop task timer (→ hours), set hours, add task photos (before/result), add/edit/
delete task materials, set material usage, toggle material done, complete-all, finish (sign-off),
add drawings. **25 routes.** Plus project create/quote/status. The capability is there.

---

## The real create flow (important architectural fact)

A **work order belongs to a project**, which belongs to a **customer**. So "Nieuwe werkbon"
is not one step — it's:

```
Customer (exists or new) → Project (exists or new) → Work order → Tasks → Materials → Photos
   → execute (start/stop, mark done) → extra work + approval → sign off → done
```

`POST /work-orders` requires `{ projectId }`. `POST /projects` requires `{ customerId }`.
So "new werkbon" must let the user pick a project (or create one quickly).

---

## THE PLAN — phases in execution order

Verify each with `tsc --noEmit` + `vite build` + curl. No browser tests. No auto-commit.

---

### W1 — Create a werkbon ("Nieuwe werkbon" button) ★ the missing front door
**Goal:** the "+ Nieuwe werkbon" button actually creates a work order and opens it.

**Backend:** exists — `POST /work-orders {projectId, title?}`, `POST /projects {customerId, name?, insulationType?}`, `GET /projects`, `GET /customers`.

**Frontend:**
- A **"Nieuwe werkbon" dialog** that:
  1. Pick a **customer** (dropdown from `GET /customers`) — or "new customer" inline.
  2. Pick an existing **project** for that customer, OR create a new one (`POST /projects`)
     with name + work type.
  3. `POST /work-orders {projectId}` → navigate to the new `/work-orders/:id`.
- Wire the dead **search field** (filter the list by number/customer, client-side).
- Decide the **star/favorites** icon: wire a simple favorite toggle, or remove it (it's not
  backed by anything — recommend removing for now, or making it a real "favorite" later).

**Done when:** clicking "Nieuwe werkbon", picking a customer + project, creates a real work order
in the DB and opens its detail page.

---

### W2 — Make the Tasks panel fully editable (execute the work)
**Goal:** the detail page can actually DO the work, not just display it.

**Backend:** all exist — add/update/delete/reorder task, toggle done, start/end timer, set hours,
add/update/delete material, set usage, toggle material done, complete-all.

**Frontend (in the detail TasksPanel):**
- **Add task** ("Taak toevoegen") → `POST /:id/tasks`.
- Per task: **edit description** (inline) → `PATCH /:id/tasks/:taskId`; **delete**;
  **toggle done** → `/toggle`; **start/stop** (timer → hours) → `/start` + `/end`;
  **set hours** manually → `/hours`.
- **Materials per task**: add line (name, qty, unit, price [hidden for technician]) →
  `POST .../materials`; edit/delete; **mark on-site / used quantity** → `/usage`, `/toggle`.
- **Complete all** button → `/complete-all`.
- Every mutation refreshes the work order.
- Respect roles: technician edits tasks/materials/photos but **never sees prices**.

**Done when:** an admin/technician can add a task, add materials, start/stop the timer, mark
things done — all persisting to the real API and reflected on reload.

---

### W3 — Sign-off (finish the werkbon)
**Goal:** complete and sign the work order.

**Backend:** `POST /work-orders/:id/finish {signature}` exists (sets signature, project → done).

**Frontend:**
- A **"Werkbon afronden" button** on the detail page (admin / assigned technician).
- A **signature step** — for now a name-typed confirmation; real signature pad comes with the
  file-storage phase (signature → image). Wire `/finish`.
- After finish: show the signed state (signature, completed), lock further edits.

**Done when:** signing off marks the work order finished, records the signature, and the project
moves to its closing state — visible in the list status and the activity log.

---

### W4 — Photos (real upload) — depends on file storage
**Goal:** before/result task photos + extra-work photos actually upload.

**Backend:** add the **object-storage adapter** (S3-compatible / Supabase Storage); wire the
already-declared photo endpoints (`/tasks/:taskId/photos/before|result`, extra-work `photo`,
signature) to accept multipart, store, return signed URLs.

**Frontend:** real camera/file input on tasks + extra-work; render from signed URLs.

**Done when:** a photo taken on a task uploads to storage and re-renders after reload.
(This is the shared "file storage" phase — it also unblocks the pre-job photo check.)

---

### W5 — Pre-job check (the other core flow)
**Goal:** before dispatch, complete a checklist + photos.

**Backend:** a pre-job checklist on the project/work order (reuse the DeliveryChecklist pattern,
or add a small pre-job checklist) + photos (W4).

**Frontend:** a pre-job section/screen: checklist items + "add photo before dispatch"; gate
"dispatch / start work" on it.

**Done when:** a work order can't be marked started until the pre-job check (photos + checklist)
is done.

---

### W6 — List polish (search, status accuracy, drawings, approve)
- Wire **search** (W1 partial) fully.
- **Supervisor approve** (`/:id/approve`) surfaced on the detail (the `approvedBySupervisor`
  flag) for the office/foreman role.
- **Drawings** (`/:id/drawings`) — attach/view drawings on the detail (needs W4 storage).
- Confirm the **derived list status** (open/on_the_way/urgent/done) updates as tasks progress.

**Done when:** the list reflects real execution state and the office can approve a work order.

---

## Role rules across all of it (enforced backend, mirrored UI)
- **admin (office):** everything — create, edit, office-approve extra work, finish, approve WO.
- **technician:** create/edit work orders + tasks + materials + photos on ASSIGNED projects;
  report extra work; **never sees prices**; cannot office-approve or client-approve.
- **client:** view own work orders; **client-approve / reject extra work**; nothing else.

## Backend gaps to fill (small)
- File storage adapter + multipart on photo endpoints (W4) — the only real backend build.
- Maybe a pre-job checklist model (W5) if not reusing DeliveryChecklist.
- Everything else (create, tasks, materials, finish, approve) **already exists** — pure wiring.

## Order
**W1 → W2 → W3** make the werkbon lifecycle fully usable with the data the app has today
(no file storage needed). **W4 → W5** add photos + pre-job (needs the storage build).
**W6** is polish. Recommend **W1 first** — without it there's no front door to any of this.
