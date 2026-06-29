import { storage } from "./storage/index.js";

// A stored object as exposed to clients: the portable `key` (used for delete)
// plus a ready-to-render `url` (presigned on S3, a served path locally).
export type PhotoRef = { key: string; url: string };

// Resolve an array of object keys into {key, url} refs. Runs the url() calls
// concurrently. Empty/absent → [].
export async function photoRefs(keys: string[] | null | undefined): Promise<PhotoRef[]> {
  if (!keys || keys.length === 0) return [];
  return Promise.all(
    keys.map(async (key) => ({ key, url: await storage.url(key) })),
  );
}

// Resolve a single optional key into a url (or undefined).
export async function photoUrl(key: string | null | undefined): Promise<string | undefined> {
  if (!key) return undefined;
  return storage.url(key);
}

// Batch-resolve many keys into a key→url lookup, so a synchronous DTO can emit
// urls without each mapper being async. Pass the returned function as `urlOf`.
export async function buildUrlMap(
  keys: (string | null | undefined)[],
): Promise<(key: string | null | undefined) => string | undefined> {
  const unique = [...new Set(keys.filter((k): k is string => !!k))];
  const entries = await Promise.all(
    unique.map(async (k) => [k, await storage.url(k)] as const),
  );
  const map = new Map(entries);
  return (key) => (key ? map.get(key) : undefined);
}

// Map an array of keys to {key, url} refs using a prebuilt urlOf lookup (sync).
export function refsFrom(
  keys: string[] | null | undefined,
  urlOf: (key: string | null | undefined) => string | undefined,
): { key: string; url: string }[] {
  if (!keys) return [];
  return keys.map((key) => ({ key, url: urlOf(key) ?? "" }));
}
