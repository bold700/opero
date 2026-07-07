import { useImperativeHandle, useRef, forwardRef, useEffect } from "react";
import Box from "@mui/material/Box";
import { RADIUS } from "../theme/tokens";

// A small canvas signature pad. Pointer-based so it works with mouse + touch +
// stylus. Exposes clear() and toBlob() via a ref. No external dependency.
export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
};

export const SignaturePad = forwardRef<
  SignaturePadHandle,
  { height?: number; onChange?: (hasInk: boolean) => void }
>(function SignaturePad({ height = 180, onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Size the canvas to its container with a device-pixel-ratio backing store so
  // strokes are crisp. A ResizeObserver (not a one-shot mount measurement) is
  // essential: inside a vaul bottom sheet the canvas has ZERO width while the
  // sheet animates in, so measuring on mount gives a 0×0 backing store and the
  // pad renders blank / collapsed. The observer fires once the sheet has actually
  // laid the canvas out (and again on rotation), so it always sizes correctly.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastW = 0;
    let lastH = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // not laid out yet
      // Skip no-op resizes so an in-progress drawing isn't wiped by the observer.
      if (rect.width === lastW && rect.height === lastH) return;
      lastW = rect.width;
      lastH = rect.height;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1A1A1A";
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!dirty.current) {
      dirty.current = true;
      onChange?.(true);
    }
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty.current = false;
      onChange?.(false);
    },
    isEmpty: () => !dirty.current,
    toBlob: () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve(null);
        canvas.toBlob((b) => resolve(b), "image/png");
      }),
  }));

  return (
    <Box
      // Never let a vaul bottom sheet start a drag from the signature canvas —
      // the pointer gesture belongs to drawing, not dismissing the sheet.
      data-vaul-no-drag
      sx={{
        border: "1.5px solid",
        borderColor: "divider",
        borderRadius: `${RADIUS.control}px`,
        bgcolor: "#fff",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height, display: "block", touchAction: "none", cursor: "crosshair" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
    </Box>
  );
});
