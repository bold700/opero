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
