# Materials screen — make it usable (plan)

Same CRUD pattern as Customers/Employees. The one wrinkle: stock data lives on a
**linked Inventory row**, and update is split across two endpoints.

---

## Data model

**Material:** name, unit, **category** (free text, default "Overig").
**Inventory** (1:1, optional): quantityInStock, reorderPoint (= min stock),
supplier, unit. A material may have no inventory row yet (stock shows 0).

**Displayed (list):** name · category · unit · stock · minStock · supplier · status
(status = derived ok/low/out_of_stock — read-only).

---

## Endpoints (all exist)
- `GET /materials` — list (material + inventory merged).
- `POST /materials` — **create takes everything in one call** (name, unit,
  category, quantityInStock, supplier, reorderPoint → seeds the inventory row).
- `PATCH /materials/:id` — **material fields only** (name, unit, category).
- `PATCH /materials/:id/inventory` — **inventory fields** (quantityInStock,
  supplier, reorderPoint, unit).
- `DELETE /materials/:id` — soft delete.

---

## The split-update plan

- **Create** → one `POST /materials` with all fields. Simple.
- **Edit** → the dialog has both material + inventory fields. On save:
  1. `PATCH /materials/:id` with name/unit/category,
  2. `PATCH /materials/:id/inventory` with stock/minStock/supplier
     (only if those changed / a material that has no inventory yet → the backend
     handles creating it; confirm, else skip when all blank).
  The page orchestrates both calls; the dialog just returns one combined input.

---

## What to build

1. **api.ts** — `createMaterial`, `updateMaterial` (material fields),
   `updateInventory` (inventory fields), `deleteMaterial` + `MaterialInput`.
2. **MaterialDialog** (create + edit), using shared `useForm` + validators:
   - **Name** — text, required.
   - **Unit** — text, required.
   - **Category** — text (free text; default "Overig"). *(dropdown later if a
     managed category list is wanted — free text matches the model for now.)*
   - **Stock** — number, `nonNegativeNumber`.
   - **Min stock** (reorder point) — number, `nonNegativeNumber`.
   - **Supplier** — text.
3. **Wire the page** (`Materials.tsx`) — search filter (name/category),
   "Materiaal toevoegen" → dialog, refetch + toast, busy/error. Admin-only writes
   (technician read-only per backend).
4. **Table** — replace the dead 👁 view icon with edit + delete (admin) → shared
   `ConfirmDialog`.
5. **Actions bar** — search/create props (like the others).
6. **i18n** — materials.dialog.*, materials.delete.*, materials.toast.*,
   table empty. Reuse number validators (already built).

---

## Decisions
- **Category = free text** for now (matches the model; the value is org content,
  not an enum). Could become a managed dropdown later if the client wants a fixed
  set — flag, don't build.
- **Roles:** admin manages; technician read-only (backend already enforces).
- Edit does the two-call split transparently; create is one call.

## Verify
tsc + vite build + curl (create with stock → edit name+stock → delete). Reuse
useForm, validators (incl. nonNegativeNumber), ConfirmDialog.
