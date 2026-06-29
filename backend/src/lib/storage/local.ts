import { promises as fs } from "node:fs";
import path from "node:path";
import type { Storage } from "./types.js";

// Dev fallback: store objects on the local filesystem under backend/var/uploads.
// Served back to the browser by the guarded GET /uploads/:key route (see
// modules/uploads). NOT for production — files don't survive a redeploy and
// don't scale past one host. Used automatically when STORAGE_* env is unset.
export class LocalDiskStorage implements Storage {
  readonly kind = "local" as const;
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(root: string, publicBaseUrl: string) {
    this.root = root;
    this.publicBaseUrl = publicBaseUrl;
  }

  private resolve(key: string): string {
    // Resolve and assert the path stays inside root (defense against traversal).
    const full = path.resolve(this.root, key);
    const rootResolved = path.resolve(this.root);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
      throw new Error("Resolved storage path escapes the uploads root");
    }
    return full;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async url(key: string): Promise<string> {
    // The app serves these via GET /uploads/:key. Return an ABSOLUTE URL on the
    // API origin so an <img src> on the client (different origin/port in dev)
    // loads it. Like an S3 presigned URL, the unguessable UUID key is the
    // capability — the serve route does not require an auth header (an <img>
    // can't send one), only that the key resolves to an existing object.
    const base = this.publicBaseUrl.replace(/\/$/, "");
    return `${base}/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await fs.rm(full, { force: true });
  }

  // Used by the serve route to stream bytes back.
  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }
}
