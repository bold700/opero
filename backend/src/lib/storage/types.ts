// The storage abstraction. One interface, two adapters (S3-compatible for prod,
// local disk for dev). Call sites only ever touch this interface, so swapping
// backends is an env change, not a code change.
//
// IMPORTANT: the DB stores the object KEY (a stable, portable string). URLs are
// minted on read via url(), so prod can hand out short-lived presigned URLs
// while the stored key never changes.
export interface Storage {
  // Persist bytes under `key`. Overwrites if the key already exists.
  put(key: string, body: Buffer, contentType: string): Promise<void>;

  // A URL the browser can GET for this object. Local → an app route
  // (/uploads/<key>); S3 → a presigned GET URL valid for `ttlSeconds`.
  url(key: string, ttlSeconds?: number): Promise<string>;

  // Read the raw bytes of an object. Used server-side to embed images (photos,
  // signature) into generated documents like the work-order PDF.
  read(key: string): Promise<Buffer>;

  // Remove the object. Best-effort: callers log failures rather than failing
  // the surrounding DB transaction (a leaked object is not a correctness bug).
  delete(key: string): Promise<void>;

  // Which adapter is active (for the boot log + health/debug).
  readonly kind: "s3" | "local";
}

// Default presign TTL for read URLs (S3 adapter). One hour balances cacheability
// against not handing out long-lived links.
export const DEFAULT_URL_TTL_SECONDS = 60 * 60;
