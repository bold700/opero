import multer from "multer";
import sharp from "sharp";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_IMAGE_DIMENSION } from "@opero/shared";
import { BadRequest } from "./httpError.js";

// Upload handling shared by every photo/signature/drawing route.
//
// Pipeline per file:
//   multer (memory) → magic-byte sniff (don't trust Content-Type) → for images,
//   sharp re-encode (strips EXIF/GPS, caps dimensions, normalizes format) → a
//   clean Buffer + contentType + ext ready for storage.put().

// Limits live in @opero/shared so the client can state them and pre-check.

// multer in memory: we never touch disk before validation.
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_IMAGE_BYTES, MAX_PDF_BYTES) },
}).single("file");

export type PreparedUpload = {
  buffer: Buffer;
  contentType: string;
  ext: string;
};

type Kind = "image" | "pdf" | "document";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOC = "application/msword";
const XLS = "application/vnd.ms-excel";

// Sniff the real type from the leading bytes. Returns null if unrecognized.
// `nameHint` is the client's filename, used ONLY to tell legacy .doc from .xls:
// both are the same OLE container and carry no cheap distinguishing marker.
function sniff(
  buf: Buffer,
  nameHint = "",
): { kind: Kind; ext: string; contentType: string } | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: "image", ext: "jpg", contentType: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { kind: "image", ext: "png", contentType: "image/png" };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { kind: "image", ext: "webp", contentType: "image/webp" };
  }
  // PDF: "%PDF-"
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") {
    return { kind: "pdf", ext: "pdf", contentType: "application/pdf" };
  }
  // Office Open XML (.docx / .xlsx): a ZIP ("PK\x03\x04") whose entries live
  // under word/ or xl/. The entry names appear verbatim in the archive, so a
  // substring scan tells the two apart without unzipping.
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const text = buf.toString("latin1");
    if (text.includes("word/")) return { kind: "document", ext: "docx", contentType: DOCX };
    if (text.includes("xl/")) return { kind: "document", ext: "xlsx", contentType: XLSX };
    return null;
  }
  // Legacy Office (.doc / .xls): OLE compound file D0 CF 11 E0 A1 B1 1A E1.
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
    buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1
  ) {
    return /\.xls$/i.test(nameHint)
      ? { kind: "document", ext: "xls", contentType: XLS }
      : { kind: "document", ext: "doc", contentType: DOC };
  }
  return null;
}

// Validate + normalize an uploaded file. `allowPdf` is true for drawings and
// attachments; `allowDocuments` (Word/Excel) only for attachments — they are
// stored as-is, never rendered by us. Throws BadRequest on anything we won't
// accept.
export async function prepareUpload(
  file: Express.Multer.File | undefined,
  opts: { allowPdf?: boolean; allowDocuments?: boolean } = {},
): Promise<PreparedUpload> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw BadRequest("No file uploaded");
  }
  const detected = sniff(file.buffer, file.originalname);
  if (!detected) {
    throw BadRequest("Unsupported or invalid file (not a JPEG/PNG/WebP/PDF/Word/Excel)");
  }

  if (detected.kind === "pdf") {
    if (!opts.allowPdf) throw BadRequest("PDF is not allowed here");
    if (file.buffer.length > MAX_PDF_BYTES) throw BadRequest("PDF too large");
    return { buffer: file.buffer, contentType: "application/pdf", ext: "pdf" };
  }

  if (detected.kind === "document") {
    if (!opts.allowDocuments) throw BadRequest("Documents are not allowed here");
    if (file.buffer.length > MAX_PDF_BYTES) throw BadRequest("Document too large");
    return { buffer: file.buffer, contentType: detected.contentType, ext: detected.ext };
  }

  // Image: re-encode through sharp. This strips EXIF/GPS metadata, caps the
  // dimensions, auto-rotates per orientation, and guarantees the bytes are a
  // real, safe image (a disguised payload fails to decode here).
  if (file.buffer.length > MAX_IMAGE_BYTES) throw BadRequest("Image too large");
  try {
    const normalized = await sharp(file.buffer)
      .rotate() // apply EXIF orientation, then drop metadata
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { buffer: normalized, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    throw BadRequest("Image could not be processed");
  }
}

// Signatures are PNG (transparent strokes on white). Keep them PNG, trim, cap
// size — a separate path from photos so we don't flatten to JPEG.
export async function prepareSignature(
  file: Express.Multer.File | undefined,
): Promise<PreparedUpload> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw BadRequest("No signature image provided");
  }
  const detected = sniff(file.buffer);
  if (!detected || detected.kind !== "image") {
    throw BadRequest("Signature must be an image");
  }
  if (file.buffer.length > MAX_IMAGE_BYTES) throw BadRequest("Signature too large");
  try {
    const png = await sharp(file.buffer)
      .resize({ width: 1200, height: 600, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { buffer: png, contentType: "image/png", ext: "png" };
  } catch {
    throw BadRequest("Signature could not be processed");
  }
}
