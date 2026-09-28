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

    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const CONTENT_TYPES: Record<string, string> = {
      png: "image/png",
      webp: "image/webp",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const contentType = CONTENT_TYPES[ext] ?? "image/jpeg";

    // Helmet protects API/HTML responses with same-origin embedding headers.
    // Uploaded assets are capability URLs and are intentionally rendered by the
    // separately hosted client (localhost uses different ports too). Keeping
    // Helmet's defaults here makes <img> thumbnails fail through CORP and blocks
    // the PDF/image viewer through X-Frame-Options/CSP, even though navigating
    // directly to the exact same URL works. Match presigned object-storage URLs:
    // allow the bytes to be embedded while retaining nosniff and the exact MIME
    // type below.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", contentType);
    // Private: these are per-tenant; don't let shared caches hold them.
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(bytes);
  }),
);
