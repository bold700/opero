# Plan: Meerwerk — catalog picker + free text

## Requirements (client-confirmed)

1. Meerwerk uses the **same material catalog dropdown picker** as task lines.
2. There is **also a free-text option** (description/qty/unit typed by hand),
   for work that isn't a catalog article.
3. Technicians never see or set prices: the catalog path resolves the price
   server-side; the free-text path shows **no price field to technicians** —
   the office (admin) prices the item afterward.
4. Scope: meerwerk only. Task lines stay exactly as they are (catalog-only,
   no free text). Approval flow, photos, and PDFs are untouched.

## Step 1 — Prisma migration

`backend/prisma/schema.prisma`, model `ExtraWork` (line ~799): add

```prisma
variantId String?
costPrice Float?
variant   MaterialVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
```

Same shape as `TaskMaterial.variantId`/`costPrice` (line ~763). Add the
back-relation on `MaterialVariant`. One migration, no data backfill needed
(existing rows are free-text rows: `variantId = null`).

## Step 2 — Backend routes (`backend/src/modules/work-orders/routes.ts`)

**New: `POST /:id/extra-work/from-catalog`** — body `{ variantId, quantity }`
(new zod schema next to `addMaterialFromCatalogSchema` in
`work-orders/schema.ts`). Copy the resolution logic of the task-line
`/materials/from-catalog` route (~line 1295): load the `MaterialVariant`,
snapshot `name`/`unit`/`unitPrice`/`costPrice`/`diameter` server-side, compute
`amount`, create the `ExtraWork` row with `variantId` set. Guard:
`requireWritableWorkOrder` (admin + assigned technician — same as today's
meerwerk report). Activity + audit entries like the existing route.

**Change: `POST /:id/extra-work`** (free text, ~line 1692) — close the price
hole:

```ts
const unitPrice = user.role === "admin" && input.unitPrice
  ? clampNumber(input.unitPrice) : 0;
```

A technician's `unitPrice` is discarded server-side no matter what the request
contains. Everything else (name/qty/unit/label) stays as-is.

**DTO** (`work-orders/dto.ts`): expose `variantId` on the extra-work DTO;
`costPrice`/margin only when `showMargin` (admin), mirroring `materialDto`.

## Step 3 — Frontend (`client/src/features/work-order-detail/`)

**`api.ts`**: add

```ts
export function reportExtraWorkFromCatalog(
  workOrderId: string,
  input: { variantId: string; quantity: number },
): Promise<unknown>
```

**`components/ExtraWorkPanel.tsx`**: the "Meerwerk melden" button becomes two
options (small menu or two buttons in the header):

- **"Kies artikel"** → opens `AddTaskLineDialog` (reused unchanged — it
  already emits `{ variantId, quantity }`) → submits via
  `reportExtraWorkFromCatalog`.
- **"Vrije tekst"** → today's inline `ReportForm`, with the price `TextField`
  rendered only for `role === "admin"` (currently it's gated on `showPrices`,
  which is the wrong gate — a client also has `showPrices` but may never
  report; change the gate to `role === "admin"`).

Row rendering (`m.name || m.description`, qty/price line) already handles both
paths — no change.

**`WorkOrderDetail.tsx`**: pass the new handler down; wire it through `run()`
+ `refreshWorkOrder()` like `handleReport`.

## Step 4 — i18n

`client/src/i18n/locales/{nl,en}/workOrderDetail.json`, under `extraWork`:

- `pickArticle`: "Kies artikel" / "Pick article"
- `freeText`: "Vrije tekst" / "Free text"

Reuse existing keys for everything else (the picker dialog brings its own).

## Step 5 — Tests + verification

- Backend vitest (`work-orders/`): new test file `extra-work-pricing.test.ts`:
  - technician POST free-text with `unitPrice: 999` → stored row has
    `unitPrice 0`, `amount 0`.
  - admin POST free-text with `unitPrice` → stored as given.
  - technician POST `/from-catalog` → price/cost snapshotted from the variant,
    response to technician has prices stripped.
- `tsc --noEmit` in backend, client, shared; `vite build`; full
  `vitest run src/modules/work-orders/`.

## Order of work

1. Migration + Prisma generate.
2. Backend schema + routes + DTO + tests green.
3. Client api.ts + ExtraWorkPanel + i18n.
4. Typecheck/build both packages, run backend suite.
