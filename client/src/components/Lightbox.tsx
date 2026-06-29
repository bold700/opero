import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";

// Full-size photo viewer. Click a thumbnail → opens here. Click anywhere or the
// close button to dismiss.
export function Lightbox({
  open,
  src,
  onClose,
}: {
  open: boolean;
  src: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open && src !== null}
      onClose={onClose}
      maxWidth="lg"
      slotProps={{ paper: { sx: { bgcolor: "transparent", boxShadow: "none" } } }}
    >
      <Box sx={{ position: "relative" }} onClick={onClose}>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(0,0,0,0.55)",
            color: "#fff",
            "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
          }}
        >
          <CloseIcon />
        </IconButton>
        {src ? (
          <Box
            component="img"
            src={src}
            alt=""
            sx={{
              display: "block",
              maxWidth: "90vw",
              maxHeight: "85vh",
              borderRadius: 1,
            }}
          />
        ) : null}
      </Box>
    </Dialog>
  );
}
