import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

// Fullscreen viewer for an attachment or photo, so opening a file never leaves
// the werkbon. Tapping a PDF used to navigate away in a new tab, which on a
// phone loses the monteur's place in the job.
//
// Two render paths, picked from the content type:
//   image → <img>, sized to the viewport
//   pdf   → <iframe>, i.e. the browser's OWN pdf engine
//
// The iframe is deliberate: every target browser ships a PDF renderer, so this
// gets pinch-zoom, scroll and text selection for free. Bundling pdf.js would
// add ~350 kB gzipped plus a worker to re-implement what the platform already
// does.
//
// TWO REAL-WORLD FAILURE MODES, both handled below rather than left to fail
// silently as a blank white box:
//
//  1. Attachment URLs are SHORT-LIVED presigned S3 GETs (1 h TTL — see
//     backend/src/lib/storage/s3.ts). A werkbon left open on a van dashboard
//     outlives its own links, and an expired one fails without an error event.
//  2. iOS Safari renders PDFs in an iframe unreliably (often page 1 only, or
//     nothing). WebKit has been like this for years.
//
// So "Open externally" is always visible — not a fallback the user has to
// discover after staring at an empty box.

export type ViewerFile = {
  url: string;
  /** Drives the render path; anything that isn't application/pdf is treated as an image. */
  contentType?: string;
  /** Shown in the header bar. Omit for photos, which need no title. */
  filename?: string;
};

export function FileViewer({
  file,
  onClose,
}: {
  /** null → closed. */
  file: ViewerFile | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isPdf = file?.contentType === "application/pdf";
  const fileUrl = file?.url;

  // An <img>/<iframe> that never fires `load` is indistinguishable from a slow
  // one, so a stuck spinner would be the whole UI. Treat "still loading after a
  // while" as failure and show the recovery actions.
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    if (!fileUrl) return;
    setState("loading");
    const timer = setTimeout(() => {
      setState((s) => (s === "loading" ? "error" : s));
    }, 12000);
    return () => clearTimeout(timer);
  }, [fileUrl]);

  const openExternally = () => {
    if (file) window.open(file.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog
      open={file !== null}
      onClose={onClose}
      fullScreen
      slotProps={{ paper: { sx: { bgcolor: "rgba(17,17,17,0.96)" } } }}
    >
      {/* Header: filename + external-open + close. Always reachable, so the
          viewer is never a dead end even when the content fails to render. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 1.5, md: 2 },
          py: 1,
          flexShrink: 0,
          // Below the notch on a phone.
          pt: "calc(8px + env(safe-area-inset-top))",
          color: "#fff",
        }}
      >
        <Typography
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file?.filename ?? ""}
        </Typography>
        <IconButton
          aria-label={t("viewer.openExternally")}
          onClick={openExternally}
          sx={{ color: "#fff" }}
        >
          <OpenInNewIcon />
        </IconButton>
        <IconButton
          aria-label={t("common.actions.close")}
          onClick={onClose}
          sx={{ color: "#fff" }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pb: "env(safe-area-inset-bottom)",
        }}
      >
        {state === "loading" ? (
          <CircularProgress sx={{ position: "absolute", color: "#fff" }} />
        ) : null}

        {state === "error" ? (
          <Box sx={{ textAlign: "center", color: "#fff", px: 3 }}>
            <Typography sx={{ mb: 0.5, fontWeight: 600 }}>
              {t("viewer.failedTitle")}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: "rgba(255,255,255,0.75)" }}>
              {t("viewer.failedBody")}
            </Typography>
            <Button variant="contained" onClick={openExternally}>
              {t("viewer.openExternally")}
            </Button>
          </Box>
        ) : file && isPdf ? (
          <Box
            component="iframe"
            key={file.url}
            src={file.url}
            title={file.filename ?? "PDF"}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            sx={{
              width: "100%",
              height: "100%",
              border: "none",
              bgcolor: "#fff",
              // Hidden rather than unmounted while loading: the load event only
              // fires for an element that is actually in the document.
              visibility: state === "ready" ? "visible" : "hidden",
            }}
          />
        ) : file ? (
          <Box
            component="img"
            key={file.url}
            src={file.url}
            alt={file.filename ?? ""}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
              visibility: state === "ready" ? "visible" : "hidden",
            }}
          />
        ) : null}
      </Box>
    </Dialog>
  );
}
