import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../../env.js";
import type { Storage } from "./types.js";
import { LocalDiskStorage } from "./local.js";
import { S3Storage } from "./s3.js";

export type { Storage } from "./types.js";
export { buildObjectKey, normalizeExt, orgIdFromKey } from "./key.js";
export type { StorageScope } from "./key.js";

// Local uploads live under backend/var/uploads (gitignored). Resolve relative to
// this file so it works regardless of process CWD.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const LOCAL_UPLOADS_ROOT = path.resolve(moduleDir, "../../../var/uploads");

// Real object storage is active only when ALL five S3 settings are present.
// Otherwise we fall back to local disk (dev). This is the single source of truth
// for "are we on real storage".
function s3Configured(): boolean {
  return Boolean(
    env.STORAGE_BUCKET &&
      env.STORAGE_ENDPOINT &&
      env.STORAGE_REGION &&
      env.STORAGE_ACCESS_KEY &&
      env.STORAGE_SECRET_KEY,
  );
}

function build(): Storage {
  if (s3Configured()) {
    return new S3Storage({
      bucket: env.STORAGE_BUCKET,
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    });
  }
  const publicBase = env.PUBLIC_API_URL || `http://localhost:${env.PORT}`;
  return new LocalDiskStorage(LOCAL_UPLOADS_ROOT, publicBase);
}

// The app-wide storage singleton. Import this everywhere; never construct an
// adapter directly at a call site.
export const storage: Storage = build();

// The concrete local adapter (or null on S3) — the serve route needs read()
// which is not part of the generic Storage interface.
export const localStorage: LocalDiskStorage | null =
  storage instanceof LocalDiskStorage ? storage : null;

// Log which backend is active at boot (no secrets).
export function logStorageBackend(): void {
  if (storage.kind === "s3") {
    // eslint-disable-next-line no-console
    console.log(
      `[opero-api] storage: S3 (endpoint=${env.STORAGE_ENDPOINT}, bucket=${env.STORAGE_BUCKET}, region=${env.STORAGE_REGION})`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`[opero-api] storage: local disk (${LOCAL_UPLOADS_ROOT})`);
  }
}
