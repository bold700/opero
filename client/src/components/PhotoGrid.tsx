import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { MAX_IMAGE_BYTES, formatMaxBytes } from "@opero/shared";
import { RADIUS, HAIRLINE } from "../theme/tokens";
import { downscaleImage, exceedsLimit } from "../lib/downscaleImage";
import { Lightbox } from "./Lightbox";

export type Photo = { key: string; url: string };

// A pending upload, shown as a placeholder tile until the parent's onAdd
// resolves. `error` set → the tile stays with a retryable failure message
// instead of vanishing silently.
type Pending = { id: number; name: string; error?: string };

let pendingId = 0;

// A reusable grid of photo thumbnails with optional add (camera/file) + delete.
// Used by work-order tasks, extra work, survey and handover. The parent owns the
// upload/delete actions and the data; this is presentational + file picking.
//
// Selecting multiple files is supported: they upload one at a time (a phone on
// site has little uplink to spare) and each gets its own placeholder tile, so
// progress is visible per file rather than as one page-wide spinner.
//
// ⚠️ RENDERING TWO OF THESE AS SIBLINGS (e.g. a zone's "vooraf" + "resultaat"):
// give each a STABLE `key`. This component holds internal state (`pending` — the
// in-flight upload tiles). Same-type siblings without keys are reconciled BY
// POSITION, so React reuses one grid's hook slots for the other and an upload
// started in one section renders its tile under the other's heading. That was a
// real reported bug ("added to resultaten, appeared in vooraf"). See ZoneCard.tsx.
export function PhotoGrid({
  photos,
  canEdit,
  busy,
  onAdd,
  onRemove,
  accept = "image/*",
  addLabel,
}: {
  photos: Photo[];
  canEdit: boolean;
  busy?: boolean;
  onAdd?: (file: File) => void | Promise<unknown>;
  onRemove?: (key: string) => void;
  accept?: string;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  const maxLabel = formatMaxBytes(MAX_IMAGE_BYTES);
  // Busy while the parent is working OR while our own queue is draining.
  const uploading = Boolean(busy) || pending.some((p) => !p.error);
  // Drives which add-affordance shows (dashed tile vs compact button). Both are
  // rendered in fixed slots so this never changes the element tree's SHAPE.
  const isEmpty = photos.length + pending.length === 0;

  const pick = () => inputRef.current?.click();

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file
    if (!files.length || !onAdd) return;

    // One at a time: keeps the request small on mobile data and lets each tile
    // report its own outcome. A failure never stops the remaining files.
    for (const file of files) {
      const id = ++pendingId;
      setPending((q) => [...q, { id, name: file.name }]);
      const fail = (msg: string) =>
        setPending((q) => q.map((p) => (p.id === id ? { ...p, error: msg } : p)));
      try {
        // Shrink first — phone photos routinely exceed the cap, and the server
        // re-encodes anyway, so the full-resolution original buys nothing.
        const { blob, filename } = await downscaleImage(file);
        if (exceedsLimit(blob.size)) {
          fail(t("photos.tooLarge", { name: file.name, max: maxLabel }));
          continue;
        }
        // Preserve File semantics for callers that read .name/.type.
        const out =
          blob instanceof File ? blob : new File([blob], filename, { type: blob.type });
        await onAdd(out);
        setPending((q) => q.filter((p) => p.id !== id));
      } catch {
        fail(t("photos.uploadFailed", { name: file.name }));
      }
    }
  };

  const THUMB = 96;

  const tileSx = {
    width: THUMB,
    height: THUMB,
    borderRadius: `${RADIUS.control}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;

  return (
    <>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {photos.map((p) => (
          <Box
            key={p.key}
            sx={{
              position: "relative",
              width: THUMB,
              height: THUMB,
              borderRadius: `${RADIUS.control}px`,
              overflow: "hidden",
              border: `1px solid ${HAIRLINE}`,
              cursor: "pointer",
              "&:hover .photo-del": { opacity: 1 },
            }}
            onClick={() => setZoom(p.url)}
          >
            <Box
              component="img"
              src={p.url}
              alt=""
              loading="lazy"
              sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {canEdit && onRemove ? (
              <IconButton
                className="photo-del"
                size="small"
                aria-label={t("common.actions.delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(p.key);
                }}
                sx={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  opacity: 0,
                  transition: "opacity .15s",
                  bgcolor: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                  p: 0.25,
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            ) : null}
          </Box>
        ))}

        {/* One placeholder per queued file: spinner while it uploads, an error
            tile (dismissable) if it failed. */}
        {pending.map((p) => (
          <Box
            key={p.id}
            title={p.error ?? p.name}
            sx={{
              ...tileSx,
              position: "relative",
              flexDirection: "column",
              gap: 0.5,
              border: "1.5px dashed",
              borderColor: p.error ? "error.main" : "divider",
              color: p.error ? "error.main" : "text.secondary",
              px: 0.5,
              textAlign: "center",
            }}
          >
            {p.error ? (
              <>
                <ErrorOutlineIcon fontSize="small" />
                <Typography variant="caption" sx={{ lineHeight: 1.2, wordBreak: "break-word" }}>
                  {p.error}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={t("common.actions.close")}
                  onClick={() => setPending((q) => q.filter((x) => x.id !== p.id))}
                  sx={{ position: "absolute", top: 0, right: 0, p: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </>
            ) : (
              <CircularProgress size={20} />
            )}
          </Box>
        ))}

        {/* The dashed add-tile, only once the grid has something in it — an
            empty section shows the compact button below instead (not a big
            empty square + a button). Rendered in a FIXED slot: `null` rather
            than an omitted node, so the element tree keeps the same shape
            whether the grid is empty or not. Same reason the empty-state button
            below is a fixed slot. See the note on state placement above. */}
        {canEdit && onAdd && !isEmpty ? (
          <Box
            role="button"
            onClick={uploading ? undefined : pick}
            sx={{
              ...tileSx,
              border: `1.5px dashed`,
              borderColor: "divider",
              color: "text.secondary",
              cursor: uploading ? "default" : "pointer",
              "&:hover": { bgcolor: uploading ? "transparent" : "action.hover" },
            }}
          >
            <AddPhotoAlternateOutlinedIcon />
          </Box>
        ) : null}
      </Box>

      {/* Empty state: one compact button, no big empty tile. Shows its own
          spinner while uploading — the dashed tile isn't rendered yet, so
          without this the first upload would have no feedback at all. */}
      {canEdit && onAdd && isEmpty ? (
        <Button
          size="small"
          startIcon={
            uploading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AddPhotoAlternateOutlinedIcon />
            )
          }
          onClick={pick}
          disabled={uploading}
        >
          {uploading ? t("photos.uploading") : (addLabel ?? t("photos.add"))}
        </Button>
      ) : null}

      {/* State the limit up front, so "too large" is never a surprise. */}
      {canEdit && onAdd ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {t("photos.limitHint", { max: maxLabel })}
        </Typography>
      ) : null}

      {/* The actual file input (camera on mobile via capture). */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={onFiles}
      />

      <Lightbox open={zoom !== null} src={zoom} onClose={() => setZoom(null)} />
    </>
  );
}
