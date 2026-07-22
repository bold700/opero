import type { AuthUser } from "../auth/types.js";
import { storage, buildObjectKey, type StorageScope } from "./storage/index.js";
import { prepareUpload, prepareSignature } from "./upload.js";

// Shared "validate → store → return key" flow used by every photo/drawing route.
//
// It does NOT touch the DB — the caller owns the transaction (push the returned
// key to the entity array, audit, append activity). Keeping persistence at the
// call site lets each route do its own activity/audit wording.
export async function storeUpload(
  user: AuthUser,
  file: Express.Multer.File | undefined,
  scope: StorageScope,
  entityId: string,
  opts: { allowPdf?: boolean } = {},
): Promise<string> {
  const prepared = await prepareUpload(file, opts);
  const key = buildObjectKey(user.orgId, scope, entityId, prepared.ext);
  await storage.put(key, prepared.buffer, prepared.contentType);
  return key;
}

// Sanitize an uploaded file's original name for DISPLAY only (never used to
// build the storage key — that stays a uuid). Strips any path, collapses
// whitespace, caps the length, and falls back to a sane default.
export function sanitizeFilename(raw: string | undefined, ext: string): string {
  const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
  // Keep letters/digits/space and a few safe punctuation chars; collapse
  // whitespace; cap length. Anything else (control chars, quotes, slashes) drops.
  const cleaned = base
    .replace(/[^\w .()+-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (cleaned) return cleaned;
  return `bestand.${ext}`;
}

//

// Store a work-order attachment (PDF or image) and return its metadata. Unlike
// storeUpload (which returns only the key), this keeps the original filename +
// size + content type so the attachments list can show and open real files.
export async function storeAttachment(
  user: AuthUser,
  file: Express.Multer.File | undefined,
  entityId: string,
): Promise<{ key: string; filename: string; contentType: string; size: number }> {
  const prepared = await prepareUpload(file, { allowPdf: true });
  const key = buildObjectKey(user.orgId, "wo-attachment", entityId, prepared.ext);
  await storage.put(key, prepared.buffer, prepared.contentType);
  return {
    key,
    filename: sanitizeFilename(file?.originalname, prepared.ext),
    contentType: prepared.contentType,
    size: prepared.buffer.length,
  };
}

// Store a drawn signature image (PNG). Separate from storeUpload so signatures
// stay PNG (transparent strokes) rather than being flattened to JPEG.
export async function storeSignature(
  user: AuthUser,
  file: Express.Multer.File | undefined,
  workOrderId: string,
): Promise<string> {
  const prepared = await prepareSignature(file);
  const key = buildObjectKey(user.orgId, "wo-signature", workOrderId, prepared.ext);
  await storage.put(key, prepared.buffer, prepared.contentType);
  return key;
}

// Best-effort delete of a stored object. Never throws — a leaked object is not a
// correctness bug, and we don't want storage hiccups to fail the DB write that
// removed the reference. Logs on failure.
export async function deleteStored(key: string): Promise<void> {
  try {
    await storage.delete(key);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[storage] failed to delete object ${key}:`, err);
  }
}
