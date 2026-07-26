import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Makes one row (a zone card, a checklist item, …) draggable-to-reorder inside
// a SortableContext. It owns the sortable transform on the wrapper and hands a
// DRAG HANDLE down via a render prop, so only the handle (grip icon) starts a
// drag — the rest of the row stays fully interactive (typing in fields, ticking
// checkboxes, etc.).
export function SortableRow({
  id,
  ariaLabel,
  children,
}: {
  id: string;
  /** Accessible name for the grip (translated by the caller). */
  ariaLabel: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const handle = (
    <IconButton
      ref={setActivatorNodeRef}
      size="small"
      aria-label={ariaLabel}
      // The grip is the ONLY drag activator. dnd-kit's listeners go here, not on
      // the whole row, so a click inside the row never turns into a drag.
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
        // Y-AXIS ONLY. These lists are vertical (verticalListSortingStrategy),
        // but PointerSensor reports raw two-axis deltas, so CSS.Transform emits
        // `translate3d(<x>px, …)` and the row tracks a drifting finger sideways.
        // A transformed, positioned element adds to its ancestors' scrollable
        // area, so that drift pans the whole page horizontally mid-drag.
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
        transition,
        // Lift the dragged row above its siblings while moving.
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.85 : 1,
        position: "relative",
      }}
    >
      {children(handle)}
    </Box>
  );
}
