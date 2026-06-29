import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { NotFound } from "../../lib/httpError.js";
import { localStorage } from "../../lib/storage/index.js";

// Serves locally-stored objects: GET /uploads/<key>.
//
// Only active for the local-disk adapter (dev). On S3 the browser fetches bytes
// directly via presigned URLs, so this route returns 404 there.
//
// Auth model (mirrors S3 presigned URLs): the unguessable UUID in the key is the
// capability. There is no auth header (an <img> tag can't send one), and the key
// can't be enumerated. The org prefix still scopes objects; a path-traversal
// guard in the adapter prevents escaping the uploads root.
export const uploadsRouter = Router();

// :key is the full object key, which contains slashes → match the rest of path.
uploadsRouter.get(
  "/*",
  asyncHandler(async (req, res) => {
    if (!localStorage) throw NotFound(); // S3 mode: nothing to serve here

    // Everything after /uploads/ is the key.
    const key = decodeURIComponent(req.params[0] ?? "");
    if (!key) throw NotFound();

    let bytes: Buffer;
    try {
      bytes = await localStorage.read(key);
    } catch {
      throw NotFound("Object not found");
    }

    const ext = key.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "pdf"
            ? "application/pdf"
            : "image/jpeg";

    res.setHeader("Content-Type", contentType);
    // Private: these are per-tenant; don't let shared caches hold them.
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(bytes);
  }),
);
