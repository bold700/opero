import { FileViewer } from "./FileViewer";

// Full-size PHOTO viewer — the image-only case of FileViewer, kept as its own
// name because that's what the photo grids ask for. Anything that also needs to
// show PDFs (attachments) should use FileViewer directly.
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
    <FileViewer file={open && src ? { url: src } : null} onClose={onClose} />
  );
}
