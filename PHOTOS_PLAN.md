# Photos, Signature & File Storage — Comprehensive Plan

The last open item in **M2 ("Everything usable", €800)**: replace every photo/signature
**placeholder** with real file upload + storage, end to end. This is "the photo-driven part"
the client is paying for.

This plan is **end-to-end**: storage layer → upload API → all 6 photo surfaces → real drawn
signature → pre-job photo check → client UI → verification. It is designed so it **works today
with zero external accounts** and is **production-ready by an env swap** (no rewrite at deploy).

---

## 0. What exists today (audited, not assumed)

**Placeholders to replace** — every one pushes a fake filename string, never a real file:

| # | Surface | Model.field (`schema.prisma`) | Route today | What it stores now |
|---|---|---|---|---|
| 1 | Task "before" photos | `WorkOrderTask.beforePhotos String[]` | `POST /work-orders/:id/tasks/:taskId/photos/before` | `begin-{ts}.jpg` |
| 2 | Task "result" photos | `WorkOrderTask.resultPhotos String[]` | `POST .../photos/result` | `resultaat-{ts}.jpg` |
| 3 | Work-order drawings | `WorkOrder.drawings String[]` | `POST /work-orders/:id/drawings` | `tekening-{ts}.pdf` |
| 4 | Survey (opname) photos | `Project.surveyPhotos String[]` | (project survey route) | placeholder |
| 5 | Extra-work photos | `ExtraWork.photos String[]` | `POST .../extra-work` (`extra-work-{ts}.jpg`) | placeholder |
| 6 | Handover photos | `Handover.photos String[]` | `POST /:id/handover/photo` | placeholder |
| 7 | **Signature** | `WorkOrder.signature String?` (+ `Handover.signedBy`) | `POST /work-orders/:id/finish {signature}` | **typed name** (TextField) |

**What already works (do NOT rebuild):**
- Sign-off **flow + lock** are real: `/finish` sets `signedAt`/`signedById`, rejects re-sign
  (`"already signed off"`). Only the signature *capture* is a placeholder.
- Photo **delete** routes exist and filter the array (`DELETE .../photos {photo}`).
- Audit + activity logging wraps every mutation.

**Infra already anticipated (reuse, don't invent):**
- `backend/src/env.ts` already validates `STORAGE_BUCKET / STORAGE_ENDPOINT /
  STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY` (currently optional, default `""`).
- `PLAN.md` already specifies a `lib/storage.ts` S3-compatible adapter with
  `putObject` / `getSignedUrl` / `deleteObject`. **This plan implements exactly that.**
- `DEPLOYMENT.md` lists "S3-compatible storage bucket" as the prod requirement.
- Prod target: Supabase Postgres + Railway (recent commits). Supabase Storage is S3-compatible.

**Constraints from the codebase:**
- API client (`client/src/lib/api/client.ts`) is **JSON-only** (`JSON.stringify`,
  `Content-Type: application/json`). Needs a **multipart path** added (don't break JSON).
- `express.json({ limit: "2mb" })` — uploads must NOT go through the JSON body parser.
- All internals English; Dutch only via i18n. One component per file. No new data libraries.

---

## 1. Storage decision (the "whole storage thing")

**One `Storage` interface, two adapters, chosen by env. No rewrite between dev and prod.**

```
backend/src/lib/storage/
  index.ts        // export const storage: Storage  (picks adapter from env)
  types.ts        // Storage interface + StoredObject type
  local.ts        // LocalDiskStorage  — dev/default, writes to ./var/uploads
  s3.ts           // S3Storage         — prod, any S3-compatible (Supabase/R2/AWS)
  key.ts          // buildObjectKey(): org-scoped, collision-proof keys
```

```ts
export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  // Returns a URL the browser can GET. Local → /uploads/<key>; S3 → presigned GET URL.
  url(key: string, ttlSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
```

**Why this design (vs. the three options first floated):**
- **Local disk now**: zero accounts, works on the laptop demo immediately. Files under
  `backend/var/uploads/` (gitignored), served by a guarded static route (§3).
- **S3 later**: set the 4 env vars → `storage` resolves to `S3Storage`, presigned URLs, done.
  No call-site changes — every route calls `storage.put/url/delete` regardless of adapter.
- **Not base64-in-DB**: rejected — bloats Postgres, slow, and the repo already chose S3.

**Adapter selection** (in `storage/index.ts`):
`STORAGE_ENDPOINT && STORAGE_BUCKET && keys present → S3Storage; else LocalDiskStorage.`
Log which adapter is active at boot.

**Object keys** (`key.ts`) — org-scoped, unguessable, stable:
`{orgId}/{scope}/{entityId}/{uuid}.{ext}` e.g.
`org_123/work-order-task-before/task_abc/3f9c...d2.jpg`. Org prefix = tenant isolation +
easy bulk cleanup. UUID = no collisions, not guessable.

**What gets stored in the DB:** the **object key** (string), NOT a URL. URLs are minted on read
(`storage.url(key)`) so they can be presigned/short-lived in prod and the key stays portable.
→ The existing `String[]` / `String?` columns are reused as-is (they hold keys instead of fake
filenames). **No schema migration needed for the photo arrays.** (Signature needs one change — §6.)

---

## 2. Upload pipeline (backend core)

**New dependency:** `multer` (memory storage) for multipart parsing on upload routes only.
Pin a version; `multer.memoryStorage()` so we get a `Buffer` to hand to `storage.put`.

**New shared upload middleware** `backend/src/lib/upload.ts`:
- `singleImage` — `multer({ storage: memoryStorage, limits: { fileSize: 10MB } }).single("file")`.
- **Validation** (defense in depth, do NOT trust client):
  - MIME allowlist: `image/jpeg`, `image/png`, `image/webp` (+ `application/pdf` for drawings).
  - **Magic-byte sniff** the buffer (don't trust the declared `Content-Type`) — reject mismatches.
  - Size cap 10 MB images / 20 MB PDFs (configurable constant).
  - On reject → `400 BadRequest("Unsupported or invalid file")`.
- **Image normalization** (recommended, via `sharp`): re-encode images → strips EXIF/GPS
  (privacy), caps max dimension (e.g. 2560px), converts to web-friendly JPEG/WebP. Reduces
  storage + guarantees the bytes are a real image, not a disguised payload. PDFs pass through.

**A reusable handler helper** `uploadAndAttach(...)` so all 6 surfaces share one code path:
1. multer parses → `req.file` (Buffer + mimetype).
2. validate + normalize → final `(buffer, contentType, ext)`.
3. `key = buildObjectKey(orgId, scope, entityId, ext)`.
4. `await storage.put(key, buffer, contentType)`.
5. In a Prisma `$transaction`: push `key` to the entity's array (or set the field), `audit(...)`,
   `appendActivity(...)` where one fires today.
6. Return the reloaded DTO (same `reloadWorkOrder` / `projectDto` path as today) — DTOs now
   resolve each key → URL via `storage.url(key)` so the client gets ready-to-render URLs.

**DTO change:** photo arrays in DTOs map `key → { key, url }` (or just `url`) via
`storage.url`. Because `storage.url` is async, the DTO mappers that emit photos become async
(or pre-resolve URLs in the route before mapping). Keep the **stored value = key**; the
**emitted value = url**. Delete routes still match on `key`.

---

## 3. Serving files

- **Local adapter:** mount a **guarded** static route `GET /uploads/:key`. Guard = require auth
  + verify the key's `{orgId}` prefix matches `req.user.orgId` (no cross-tenant reads). Set
  `Cache-Control`, correct `Content-Type`. Files live outside the JSON parser. (Do NOT use a
  blanket `express.static` on the raw dir — that would leak across orgs.)
- **S3 adapter:** `storage.url()` returns a **presigned GET URL** (TTL e.g. 1h); the browser
  hits S3/Supabase directly. No bytes through our API on read.
- Either way the client just gets a URL string and renders `<img src=...>`.

---

## 4. The 6 photo surfaces — concrete route work

All become real uploads via the shared helper. Routes keep their existing paths/permissions.

| Surface | Route (unchanged path) | scope tag | entity array |
|---|---|---|---|
| Task before | `POST /work-orders/:id/tasks/:taskId/photos/before` | `wo-task-before` | `WorkOrderTask.beforePhotos` |
| Task result | `POST /work-orders/:id/tasks/:taskId/photos/result` | `wo-task-result` | `WorkOrderTask.resultPhotos` |
| WO drawings | `POST /work-orders/:id/drawings` | `wo-drawing` | `WorkOrder.drawings` (PDF allowed) |
| Survey | `POST` (project survey photo route) | `survey` | `Project.surveyPhotos` |
| Extra-work | `POST .../extra-work` (already takes `photo`) | `extra-work` | `ExtraWork.photos` |
| Handover | `POST /:id/handover/photo` | `handover` | `Handover.photos` |

- Replace each `placeholder = \`...-${Date.now()}.jpg\`` + `{ push: placeholder }` with the
  `uploadAndAttach` flow. Keep permission guards (`requireWritableWorkOrder`, role checks).
- Extra-work currently takes a boolean-ish `photo` in JSON at create time; split into
  create-then-upload, or accept multipart on that route. (Decide during build; lean: keep
  create JSON, add a dedicated `POST .../extra-work/:id/photo` upload route for symmetry.)
- **Delete** routes: unchanged contract (match by key), but ALSO call `storage.delete(key)` so
  we don't leak orphaned objects. Wrap so a storage-delete failure doesn't break the DB tx
  (log + best-effort).

---

## 5. Signature — real drawn signature

**Client:** replace the typed-name `TextField` in `SignOffDialog.tsx` with a **canvas signature
pad** (small dependency `react-signature-canvas`, or a ~40-line hand-rolled `<canvas>` with
pointer events — prefer hand-rolled to avoid a dep; one component file
`components/SignaturePad.tsx`). On confirm: export the canvas to a PNG `Blob`
(`canvas.toBlob`), upload it.

**Backend:** `POST /work-orders/:id/finish` changes from `{ signature: string }` (typed name)
to a **multipart upload** of the signature image:
- multer single image → normalize (PNG, trim, cap size) → `storage.put` → key.
- Set `WorkOrder.signature = key` (now an object key, not a name), `signedAt`, `signedById`.
- Keep the existing **lock** (`if (signedAt) throw "already signed off"`) and audit/activity.
- DTO emits `signatureUrl = storage.url(key)` for display on the locked work order.

**Schema:** `WorkOrder.signature String?` already exists and now holds a key — **no migration
strictly required**, but add a clarifying comment. (Optionally also capture the signer's typed
name separately as `signedByName` for the printed record — small optional migration; decide in
build. Handover already has `signedBy String?`.)

**Finish schema** (`finishSchema`) drops the string body; validation moves to the upload
middleware (a signature image is required → 400 if absent).

---

## 6. Pre-job photo check (the dispatch gate)

The milestone: *"the pre-job photo check before a monteur is sent out."* `PLAN.md` already
sketched this: a checklist + required photos before a job is marked dispatched. `DeliveryChecklist`
exists (that's the *post*-job/handover checklist) — pre-job needs its own small structure.

**Design (minimal, reuses patterns):**
- Add a **pre-job check** concept on the work order (or project). Two parts:
  1. a short checklist (a few boolean items, label keys via i18n), and
  2. **required photos** (reuse a photo array, e.g. a new `WorkOrder.prejobPhotos String[]`
     or reuse `beforePhotos` semantically — decide in build; leaning new field for clarity).
- A work order cannot be marked **dispatched / sent** until the pre-job check is complete
  (checklist done + ≥1 photo). Enforce server-side on whatever "dispatch" transition exists
  (or add a `dispatchedAt` + `POST /work-orders/:id/dispatch` guard).
- **Schema migration:** add `prejobPhotos String[]` and a small checklist (either a JSON blob
  `prejobCheck Json?` or a tiny related table mirroring `DeliveryChecklistItem`). Lean: JSON
  blob to keep it light, consistent with the per-user `preferences Json?` precedent.
- Client: a **Pre-job check** section/dialog on the work-order (or planning) screen — checklist
  toggles + photo upload + a disabled "Dispatch" button until complete.

*(This is the fuzziest sub-feature; §9 asks the one product question that pins it down.)*

---

## 7. Client work

- **API client:** add a multipart path — `api.upload(path, file, fields?)` that builds
  `FormData`, sets the auth header, and **omits** `Content-Type` (let the browser set the
  multipart boundary). Reuses the 401-refresh-retry logic. Keep `api.post/get/...` untouched.
- **PhotosPanel.tsx** (`work-order-detail`): replace the disabled "coming soon" placeholder with
  a real grid: before/result thumbnails (from URLs), a camera/file `<input capture>` for upload,
  per-photo delete, loading/error states, optimistic-ish refresh via the existing reload.
  Mobile: `<input type="file" accept="image/*" capture="environment">` → opens the camera on a
  phone (matters for the on-site monteur).
- **SignaturePad.tsx** + updated `SignOffDialog.tsx` (§5).
- **Extra-work, survey, handover** photo bits: wire their add/upload + thumbnails using the same
  upload helper and a small shared `PhotoThumb` / `PhotoGrid` component
  (`client/src/components/` since 3+ features use it).
- **Pre-job check** UI (§6).
- **i18n:** add NL + EN keys for all new strings (upload, take photo, remove, signature, sign
  here, pre-job check, dispatch, errors). No Dutch in code.
- **Lightbox (optional, nice):** click a thumbnail → full-size view.

---

## 8. Verification (no browser — curl + tests, per repo rule)

- **Unit:** storage adapters (`local` round-trip put→url→delete; key builder; MIME/magic-byte
  validation rejects a renamed `.txt`→`.jpg`).
- **Integration (vitest + supertest-style):** upload a real small image buffer to each of the 6
  routes → assert 201, array length grew, stored value is a key, DTO returns a URL; delete →
  array shrinks + `storage.delete` called. Signature finish → `signedAt` set + locked + re-sign
  rejected. Pre-job gate → dispatch blocked until complete, allowed after.
- **curl smoke (local adapter):** `curl -F file=@sample.jpg -H "auth..."` against a running API;
  confirm `GET /uploads/<key>` returns the bytes and **cross-org key → 403**.
- **Tenant isolation test:** org A user cannot fetch org B's object key.
- `tsc --noEmit` (shared/backend/client), `vite build`, full `vitest run` green.
- Clean up any test objects + DB rows after (as we did for the price-toggle e2e).

---

## 9. Build order (phased, each independently shippable)

1. **Storage layer** — `lib/storage/*` (interface + local + s3 + key), env wiring, boot log.
   Unit-tested in isolation. *No behavior change yet.*
2. **Upload middleware** — `lib/upload.ts` (multer + validate + sharp normalize) + the guarded
   `GET /uploads/:key` serve route for local. Unit-tested.
3. **Wire the 6 photo surfaces** to real upload via `uploadAndAttach`; DTOs emit URLs; deletes
   purge storage. Integration-tested.
4. **Client photos** — multipart `api.upload`, `PhotoGrid`/`PhotoThumb`, real `PhotosPanel`,
   extra-work/survey/handover thumbnails, i18n.
5. **Signature** — `SignaturePad` + `SignOffDialog` + `/finish` multipart + DTO `signatureUrl`.
6. **Pre-job photo check** — schema bit, dispatch gate, UI (after the product Q in §10).
7. **Full verification sweep** (§8) + cleanup. Update `MILESTONES.md` (closes M2).

Steps 1–5 close the bulk of "photos + signature." Step 6 is the dispatch gate.

---

## 10. Open product questions (need answers before/at build)

1. **Pre-job photo check — what exactly gates dispatch?** Just "≥1 photo + a checklist", or a
   specific required list (e.g. "photo of the facade", "photo of access")? And is the gate on the
   **work order** or the **planning/dispatch** action? (Drives §6 schema + the dispatch transition.)
2. **Signature record:** keep just the drawn image, or also store the signer's **typed name**
   alongside it for the printed work order? (Tiny optional migration.)
3. **Storage for the demo:** confirm **local disk now, S3 at M3 deploy** (this plan's default) —
   or do you want S3/Supabase wired immediately?
4. **Drawings** (PDF) — in scope for this pass, or images-only first and PDFs later?

---

## Out of scope (explicitly, to avoid scope creep)
- Server-side **PDF generation** of the work order (that's a separate PLAN.md phase).
- Virus scanning / AV pipeline (note as a prod hardening item for M3).
- Image CDN / thumbnails-on-the-fly service (presigned URLs + one normalized size is enough now).
- Bulk migration of existing fake placeholder filenames (they're demo seed data; we can re-seed).
