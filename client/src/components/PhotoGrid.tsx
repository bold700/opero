import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { RADIUS, HAIRLINE } from "../theme/tokens";
import { Lightbox } from "./Lightbox";

export type Photo = { key: string; url: string };

// A reusable grid of photo thumbnails with optional add (camera/file) + delete.
// Used by work-order tasks, extra work, survey and handover. The parent owns the
// upload/delete actions and the data; this is presentational + file picking.
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
  onAdd?: (file: File) => void;
  onRemove?: (key: string) => void;
  accept?: string;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAdd) onAdd(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const THUMB = 96;

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

        {canEdit && onAdd ? (
          <Box
            role="button"
            onClick={busy ? undefined : pick}
            sx={{
              width: THUMB,
              height: THUMB,
              borderRadius: `${RADIUS.control}px`,
              border: `1.5px dashed`,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
              cursor: busy ? "default" : "pointer",
              "&:hover": { bgcolor: busy ? "transparent" : "action.hover" },
            }}
          >
            {busy ? <CircularProgress size={20} /> : <AddPhotoAlternateOutlinedIcon />}
          </Box>
        ) : null}
      </Box>

      {/* Fallback explicit button (also opens the picker) when there are no
          thumbnails yet, to make the affordance obvious on mobile. */}
      {canEdit && onAdd && photos.length === 0 ? (
        <Button
          size="small"
          startIcon={<AddPhotoAlternateOutlinedIcon />}
          onClick={pick}
          disabled={busy}
          sx={{ mt: 1 }}
        >
          {addLabel ?? t("photos.add")}
        </Button>
      ) : null}

      {/* The actual file input (camera on mobile via capture). */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        hidden
        onChange={onFile}
      />

      <Lightbox open={zoom !== null} src={zoom} onClose={() => setZoom(null)} />
    </>
  );
}
