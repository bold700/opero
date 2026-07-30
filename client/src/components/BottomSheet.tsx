import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { Drawer as Vaul } from "vaul";
import { CARD_BG, RADIUS } from "../theme/tokens";

const HANDLE_COLOR = "#D5D0DD";

// Visually hidden but screen-reader-available (matches Radix/MUI's a11y pattern).
const srOnly = {
  position: "absolute" as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
};

// A draggable mobile bottom sheet (vaul) for overlays that are NOT dialogs:
// the quick-create menu, the bottom-nav "more" menu, notifications, planning
// details. Same drag physics as ResponsiveDialog's mobile sheet — real grab
// handle, velocity-based swipe-down to dismiss, page dimmed behind — so every
// bottom sheet in the app closes the same way. (Previously these were MUI
// <Drawer anchor="bottom">, which painted a decorative handle but had no drag
// support at all.)
//
// Mobile-only by usage: callers branch on their own breakpoint and render
// something else (dropdown, side panel) on desktop.
export function BottomSheet({
  open,
  onClose,
  title,
  header,
  children,
  scrollableContent = false,
  maxHeight = "92dvh",
}: {
  open: boolean;
  /** Swipe-down / backdrop tap / Escape. */
  onClose: () => void;
  /** Accessible name for the sheet (required by vaul/Radix; visually hidden). */
  title: string;
  /** Pinned below the handle, outside the scrollable content. */
  header?: ReactNode;
  children: ReactNode;
  /** Set when the content contains its own scroll area (lists, long bodies).
   *  Marks the content data-vaul-no-drag so an upward swipe scrolls it instead
   *  of falling through vaul's shouldDrag() into a sheet drag (see the same
   *  guard in ResponsiveDialog); the sheet then drags only from the handle /
   *  header. Leave false for short menus — the whole sheet is a drag surface. */
  scrollableContent?: boolean;
  /** Viewport cap; the sheet sizes to content up to this. */
  maxHeight?: string;
}) {
  return (
    <Vaul.Root
      open={open}
      // vaul calls this with `false` on swipe-dismiss / overlay tap / Escape.
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Vaul.Portal>
        <Vaul.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1300,
          }}
        />
        <Vaul.Content
          aria-describedby={undefined}
          // Never move focus into the sheet on open (Radix does by default);
          // matches ResponsiveDialog — avoids scroll/keyboard jumps mid-animation.
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight,
            zIndex: 1300,
            display: "flex",
            flexDirection: "column",
            outline: "none",
          }}
        >
          <Box
            sx={{
              bgcolor: CARD_BG,
              borderTopLeftRadius: `${RADIUS.card}px`,
              borderTopRightRadius: `${RADIUS.card}px`,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              pb: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Accessible name (required by vaul/Radix); visible title, if any,
                comes from `header`/`children`. */}
            <Vaul.Title style={srOnly}>{title}</Vaul.Title>
            {/* Real drag handle — swipe down to dismiss. */}
            <Vaul.Handle
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                margin: "10px auto 4px",
                background: HANDLE_COLOR,
                flexShrink: 0,
              }}
            />
            {header}
            {scrollableContent ? (
              <Box data-vaul-no-drag sx={{ display: "contents" }}>
                {children}
              </Box>
            ) : (
              children
            )}
          </Box>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
