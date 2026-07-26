// Upload limits — one source of truth for the client and the backend.
//
// The backend ENFORCES these (multer limit + an explicit size check after the
// magic-byte sniff). The client reads the same numbers to tell the user the
// limit up front and to downscale oversized photos before sending them, so a
// technician on mobile data doesn't upload 12 MB only to be rejected.
//
// The client-side check is a UX layer, never the boundary: the server rejects
// oversized uploads regardless of what the client did.

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB raw upload
export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB for drawings
export const MAX_IMAGE_DIMENSION = 2560; // px, longest side after normalization

// "12 MB" — for user-facing copy, so the hint can never drift from the limit.
export function formatMaxBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
