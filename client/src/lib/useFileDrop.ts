import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type DragEventHandler,
} from "react";

export function useFileDrop({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void | Promise<unknown>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (!disabled) return;
    dragDepth.current = 0;
    setIsDragging(false);
  }, [disabled]);

  const hasFiles = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const onDragEnter: DragEventHandler<HTMLDivElement> = (event) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDrop: DragEventHandler<HTMLDivElement> = (event) => {
    if (disabled || !hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) void onFiles(files);
  };

  return {
    isDragging,
    dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
