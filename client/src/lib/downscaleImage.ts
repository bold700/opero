import { MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION } from "@opero/shared";

// Shrink a photo in the browser before uploading it.
//
// Why: phone cameras produce 8–15 MB JPEGs, which either blow the server's
// limit outright or crawl over mobile data on site. The backend re-encodes and
// caps dimensions anyway (sharp, see backend/src/lib/upload.ts), so sending the
// full-resolution original buys nothing — we lose no quality the server would
// have kept.
//
// This is a UX optimization, not a security boundary: the server still enforces
// MAX_IMAGE_BYTES on whatever arrives.

// Non-images (PDF drawings) pass through untouched.
function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

// Files already comfortably inside the limit and the dimension cap aren't worth
// a decode/re-encode round trip.
const SKIP_BELOW_BYTES = 1024 * 1024; // 1 MB

type Result = { blob: Blob; filename: string };

// Load a File into an ImageBitmap (fast path) or an <img> (fallback).
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path — some browsers refuse odd formats here.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resize `file` so its longest side is at most MAX_IMAGE_DIMENSION and re-encode
// as JPEG. Returns the original untouched when it's not an image, is already
// small, or if anything goes wrong — the upload should still be attempted, and
// the server has the final say.
export async function downscaleImage(file: File): Promise<Result> {
  if (!isImage(file)) return { blob: file, filename: file.name };
  if (file.size < SKIP_BELOW_BYTES) return { blob: file, filename: file.name };

  try {
    const img = await loadImage(file);
    const w = img.width;
    const h = img.height;
    const longest = Math.max(w, h);
    const scale = longest > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longest : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, filename: file.name };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if ("close" in img) img.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    // Only take the re-encoded version if it actually helped.
    if (!blob || blob.size >= file.size) return { blob: file, filename: file.name };

    return { blob, filename: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    return { blob: file, filename: file.name };
  }
}

// True when the file is still over the server's cap and should be rejected
// before we waste an upload on it.
export function exceedsLimit(size: number): boolean {
  return size > MAX_IMAGE_BYTES;
}
