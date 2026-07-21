# Plan: file attachments on a work order

Client item: **"Allow PDFs and other files to be uploaded to work orders."**

## What already exists (and what doesn't)

- The **upload pipeline already handles PDFs**: `prepareUpload(file, { allowPdf: true })`
  sniffs magic bytes, caps PDFs at 25 MB, and stores them
  (`backend/src/lib/upload.ts`, `attachUpload.ts`). `SAFE_EXT` today =
  `jpg/png/webp/pdf` only.
- The **"drawings" feature** is the working precedent: `POST/DELETE
  /work-orders/:id/drawings` accepts an image OR a PDF, pushes the object key
  onto `WorkOrder.drawings string[]`, and the DTO resolves keys → `{key,url}`.
- **BUT drawings is half-built and the wrong model to copy wholesale:**
  1. Nothing in the client renders `drawings` — `uploadDrawing`/`deleteDrawing`
     exist in `api.ts` but no component calls them. It's dead UI.
  2. `PhotoGrid` (the only attachment UI) renders `<img>` thumbnails + an image
     Lightbox — it **cannot display a PDF**. A file needs a list row (icon +
     name + open), not an image grid.
  3. The object key is `orgId/scope/entityId/<uuid>.pdf` — the **original
     filename is discarded**. A `string[]` of keys can never show
     "Offerte_Jansen.pdf". A real attachments feature must persist the filename.

So this is not "flip allowPdf on the photo routes." It needs a small proper
model + its own list UI.

## Decisions needed from the client (flagged, not assumed)

1. **"and other files" — which types?** The pipeline only recognizes
   image/PDF. Word/Excel/etc. would each need a magic-byte signature, no sharp
   re-encode, and a virus-scan consideration, since we'd be storing arbitrary
   office documents users later download.
   - **Recommended:** ship **PDF (+ the existing image types)** now — it's what
     the pipeline safely supports and covers the stated "PDFs" need. Add more
     types later only if the client names them.
   - Alternative: a general allow-list (pdf, docx, xlsx, csv, txt…). Larger,
     and stored-document download is a security surface worth a separate pass.
2. **Where do they attach — the whole werkbon, or per zone?** The feedback says
   "to work orders," so **werkbon-level** (one Attachments panel on the detail
   screen). Per-zone is possible later but not asked for.

The plan below assumes **PDF + images, werkbon-level**. If either answer
changes, only the scope of step 1/3 shifts.

## Step 1 — Data model (new table, not a string[])

`backend/prisma/schema.prisma` — a real row so the filename/size/uploader
survive:

```prisma
model WorkOrderAttachment {
  id          String   @id @default(uuid())
  workOrderId String
  key         String   // storage object key
  filename    String   // original name, shown in the UI
  contentType String
  size        Int
  uploadedById String?
  createdAt   DateTime @default(now())

  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  uploadedBy  User?     @relation(fields: [uploadedById], references: [id], onDelete: SetNull)

  @@index([workOrderId])
}
```

Add the back-relation on `WorkOrder` and `User`. One migration.

(Leave `WorkOrder.drawings` alone — out of scope. If the client later wants
drawings folded into attachments, that's a separate cleanup.)

## Step 2 — Storage plumbing

- Add `"wo-attachment"` to `StorageScope` (`storage/key.ts`).
- `storeUpload` already accepts `{ allowPdf: true }` and derives the ext from
  the sniffed type — no change needed there for PDF.
- `prepareUpload` returns `{ buffer, contentType, ext }`; expose the **original
  filename** to the caller (multer already has `file.originalname`) so the route
  can persist it. Sanitize it for display (strip path, cap length) — it is
  metadata only, never used to build the key.

## Step 3 — Backend routes (`work-orders/routes.ts`)

Mirror the drawings pair, but write to the new table and return the row:

- **`POST /work-orders/:id/attachments`** — `uploadSingle`,
  `requireWritableWorkOrder` (admin + assigned technician, same as drawings),
  `storeUpload(..., "wo-attachment", id, { allowPdf: true })`, create the
  `WorkOrderAttachment` with `filename`/`contentType`/`size`/`uploadedById`,
  audit `workOrder.attachment.add`, return `reloadWorkOrder`.
- **`DELETE /work-orders/:id/attachments/:attachmentId`** — load (org-scoped
  via the werkbon), delete the row, then `deleteStored(key)`, audit
  `workOrder.attachment.remove`.
- **DTO**: add `attachments: {id, filename, contentType, size, url, createdAt}[]`
  to `workOrderDto`, resolving each `key → url` via `photoUrl`. Include the
  relation in `workOrderInclude`. No price/role gating — attachments are
  documents, visible to anyone who can view the werkbon.

## Step 4 — Client

- **`api.ts`**: `WorkOrderAttachment` type + `uploadAttachment(woId, file)` /
  `deleteAttachment(woId, attachmentId)`; add `attachments` to the `WorkOrder`
  type.
- **New `AttachmentsPanel.tsx`** (own file, per the one-component rule) — a
  simple list, NOT PhotoGrid:
  - each row: file-type icon (PDF vs image), filename, size, an "open" link
    (`<a href={url} target="_blank" rel="noreferrer">`) and a delete button
    (canWrite, hidden when the werkbon is signed/`finished`).
  - an "Add file" button → `<input type="file" accept="application/pdf,image/*">`.
  - empty state + busy state, consistent with the other panels.
- **`WorkOrderDetail.tsx`**: render `<AttachmentsPanel>` in the left column
  under ExtraWork (or the right column — match the existing card rhythm), wired
  through `run()` + `refreshWorkOrder()`.
- **i18n** (`nl`/`en` workOrderDetail.json) under a new `attachments` key:
  `title`, `add`, `empty`, `openAria`, `deleteAria`, plus a size formatter
  (or reuse an existing bytes helper if one exists — check `lib`).

## Step 5 — Tests + verification

- Backend `attachments.test.ts` (mirror `pdf.test.ts` / `photos.test.ts`):
  - admin uploads a PDF → row created with the original filename, appears in the
    DTO with a url;
  - assigned technician can upload; an unassigned technician is blocked (404);
  - a disguised/non-allowed file is rejected (400) — reuse the sniff guard;
  - delete removes the row and calls storage delete.
- Then: `tsc --noEmit` (backend, shared, client), full
  `vitest run src/modules/work-orders/`, `vite build`.

## Order of work

1. Answer the two flagged decisions (types, placement).
2. Migration + storage scope + filename plumbing.
3. Routes + DTO + tests green.
4. Client api + AttachmentsPanel + wire-in + i18n.
5. Full typecheck / suite / build.

## Explicitly out of scope

- Wiring up the dead `drawings` UI (separate half-finished feature).
- Non-image/PDF file types, unless the client names them (decision 1).
- Virus scanning of stored documents — worth raising if arbitrary office files
  get greenlit, but not needed for PDF/images.
