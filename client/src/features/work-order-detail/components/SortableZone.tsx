import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Makes one zone draggable-to-reorder. It owns the sortable transform on the
// wrapper and hands a DRAG HANDLE down to the card via a render prop, so only
// the handle (top-left grip) starts a drag — the rest of the card stays fully
// interactive (typing in fields, tapping lines, etc.).
export function SortableZone({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const handle = (
    <IconButton
      ref={setActivatorNodeRef}
      size="small"
      aria-label="reorder"
      // The grip is the ONLY drag activator. dnd-kit's listeners go here, not on
      // the whole card, so a click inside the card never turns into a drag.
      {...attributes}
      {...listeners}
      sx={{
        cursor: "grab",
        color: "text.disabled",
        ml: -0.5,
        touchAction: "none", // let dnd-kit own the touch gesture on the grip
        "&:active": { cursor: "grabbing" },
        "&:hover": { color: "text.secondary" },
      }}
    >
      <DragIndicatorIcon fontSize="small" />
    </IconButton>
  );

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Lift the dragged card above its siblings while moving.
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.85 : 1,
        position: "relative",
      }}
    >
      {children(handle)}
    </Box>
  );
}
