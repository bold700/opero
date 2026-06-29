import { randomUUID } from "node:crypto";

// Object keys are org-scoped, collision-proof and content-typed:
//
//   <orgId>/<scope>/<entityId>/<uuid>.<ext>
//   e.g. org_123/wo-task-before/task_abc/3f9c...d2.jpg
//
// - The org prefix gives tenant isolation (a read guard checks the prefix) and
//   makes bulk cleanup per-org trivial.
// - The UUID makes keys unguessable and collision-free.
// - The scope groups objects by feature for easy auditing.

// The feature areas that own uploaded objects.
export type StorageScope =
  | "wo-task-before"
  | "wo-task-result"
  | "wo-drawing"
  | "wo-signature"
  | "wo-prejob"
  | "survey"
  | "extra-work"
  | "handover";

// Only allow a small, safe set of extensions through into keys.
const SAFE_EXT = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

export function normalizeExt(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  const safe = e === "jpeg" ? "jpg" : e;
  if (!SAFE_EXT.has(safe)) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }
  return safe;
}

export function buildObjectKey(
  orgId: string,
  scope: StorageScope,
  entityId: string,
  ext: string,
): string {
  // Guard against path traversal from any caller-supplied id.
  const safeOrg = sanitizeSegment(orgId);
  const safeEntity = sanitizeSegment(entityId);
  return `${safeOrg}/${scope}/${safeEntity}/${randomUUID()}.${normalizeExt(ext)}`;
}

// The org segment of a key, used by the local serve route to authorize reads.
export function orgIdFromKey(key: string): string | null {
  const seg = key.split("/")[0];
  return seg ? seg : null;
}

// Keys are built from our own ids, but be defensive: strip anything that could
// escape the prefix or the bucket layout.
function sanitizeSegment(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) throw new Error("Invalid storage key segment");
  return cleaned;
}
