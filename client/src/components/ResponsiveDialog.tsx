import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Drawer as Vaul } from "vaul";
import { CARD_BG, RADIUS } from "../theme/tokens";

// The DOM node MUI popovers (Select/Autocomplete/Menu) should portal INTO when
// they're inside a mobile sheet. vaul (Radix Dialog) blocks pointer events on
// anything portaled to document.body OUTSIDE its content, so a Select menu would
// be unclickable. Rendering the menu inside the sheet's own subtree fixes it.
// `null` on desktop → MUI's default (document.body), which is correct there.
const SheetContainerContext = createContext<HTMLElement | null>(null);

// Use inside any dialog for MUI Select/TextField-select/Menu popovers so they
// stay clickable in the mobile sheet. Spread onto <Select MenuProps={...}> or
// pass `.container` to slotProps. On desktop it's a no-op (undefined container).
export function useSheetMenuProps() {
  const container = useContext(SheetContainerContext);
  return {
    /** For <Select> / <TextField select>: `MenuProps={useSheetMenuProps().menu}` */
    menu: { container: container ?? undefined },
    /** For <Autocomplete>: `slotProps={{ popper: useSheetMenuProps().popper }}` */
    popper: { container: container ?? undefined },
    /** Raw container node (or undefined) if you need it directly. */
    container: container ?? undefined,
  };
}

const HANDLE_COLOR = "#D5D0DD";

// A dialog that adapts to screen size:
//  - Desktop (sm+): a centered MUI Dialog (the classic modal card).
//  - Mobile (xs):   a DRAGGABLE bottom sheet (vaul) — slides up from the bottom,
//                   rounded top, a real grab handle you can swipe DOWN to dismiss
//                   (velocity-based), only as tall as its content (long forms fill
//                   most of the screen and scroll internally), page dimmed behind.
//
// Drop-in for `<Dialog>`: put the usual DialogTitle / DialogContent /
// DialogActions inside as children — they render correctly in both. Pass
// `maxWidth` for the desktop width (default "sm").
//
// vaul only starts a drag from the handle/header or when the inner scroll area is
// at the top, so long forms scroll normally and drawing on the SignaturePad (which
// lives inside the scrollable DialogContent) never drags the sheet.
// Visually-hidden but screen-reader-available (matches Radix/MUI's a11y pattern).
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

export function ResponsiveDialog({
  open,
  onClose,
  children,
  maxWidth = "sm",
  title,
  stableHeight = false,
  sheetBelow = "sm",
}: {
  open: boolean;
  /** Backdrop click / Escape / swipe-down. Pass `undefined` to lock (e.g. busy) —
   *  when undefined the sheet is NOT dismissible, so a swipe can't cancel a save. */
  onClose?: () => void;
  children: ReactNode;
  maxWidth?: "xs" | "sm" | "md";
  /** Accessible name for the sheet (screen readers). The visible title still comes
   *  from the DialogTitle inside `children`; this satisfies vaul/Radix's required
   *  Dialog.Title so there's no a11y warning. */
  title: string;
  /** For multi-step / progressive-disclosure forms: hold a FIXED sheet height on
   *  mobile (85dvh) so revealing/hiding sub-fields scrolls WITHIN the sheet instead
   *  of resizing it — vaul re-animates its position on every content-height change,
   *  which reads as "jumpy". Leave false for simple forms (they size to content). */
  stableHeight?: boolean;
  /**
   * Below which breakpoint this renders as a bottom sheet instead of a centered
   * dialog. Defaults to "sm" (phones) — the right answer for ordinary forms.
   *
   * Raise it when the SURROUNDING page has already collapsed to one column at a
   * wider breakpoint: a sheet is the fix for "this content is now buried three
   * screens down", and that problem starts wherever the sidebar disappears, not
   * at 600px. See the werkbon Projectinfo sheet (its layout splits at lg).
   */
  sheetBelow?: "sm" | "md" | "lg";
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down(sheetBelow));
  // The sheet content node — MUI menus inside portal here so they stay clickable.
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null);

  // Pin the document at 0 while the sheet is open. iOS Safari scrolls the
  // DOCUMENT (not an inner scroller) to center a focused input, and leaves the
  // page pannable while the keyboard is up — that's the "background page scrolls
  // behind the sheet" bug. vaul has its own countermeasure, but it tears it down
  // on every pointerdown inside the sheet (its isDragging gate), i.e. exactly
  // while the user is touching. The document is never meant to scroll in this
  // app, so resetting unconditionally is safe and can't fight a real scroll.
  useEffect(() => {
    if (!mobile || !open) return;
    const reset = () => window.scrollTo(0, 0);
    window.addEventListener("scroll", reset);
    return () => window.removeEventListener("scroll", reset);
  }, [mobile, open]);

  if (mobile) {
    return (
      <Vaul.Root
        open={open}
        // vaul calls this with `false` on swipe-dismiss / overlay tap / Escape.
        onOpenChange={(next) => {
          if (!next) onClose?.();
        }}
        // Locked while busy (onClose undefined): swipe/tap-away can't cancel a save.
        dismissible={Boolean(onClose)}
        repositionInputs
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
            // NEVER move focus into the sheet on open (Radix does by default).
            // On mobile, focusing an input summons the keyboard mid-animation,
            // which collides with repositionInputs and leaves the sheet stuck
            // half-open at the bottom. The user taps a field when they're ready.
            onOpenAutoFocus={(e) => e.preventDefault()}
            // A MUI Select/Autocomplete menu renders its own full-screen
            // backdrop, and even when the menu portals INTO this sheet that
            // backdrop sits outside Vaul.Content — so picking an option reads as
            // an outside press and dismisses the whole sheet. Ignore any press
            // that started inside a MUI popover; the menu closes itself.
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest(".MuiPopover-root, .MuiModal-root, .MuiAutocomplete-popper")) {
                e.preventDefault();
              }
            }}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              // Bound the sheet's own height to the viewport so the inner
              // DialogContent's `flex:1` actually resolves to a real height and
              // scrolls. Without this cap the content grows unbounded and the last
              // fields / actions fall below the fold, un-scrollable (the "doesn't
              // fully open / can't reach the bottom" bug).
              maxHeight: "92dvh",
              zIndex: 1300,
              display: "flex",
              flexDirection: "column",
              outline: "none",
            }}
          >
            <Box
              ref={setSheetEl}
              sx={{
                bgcolor: CARD_BG,
                borderTopLeftRadius: `${RADIUS.card}px`,
                borderTopRightRadius: `${RADIUS.card}px`,
                // stableHeight: a FIXED 85dvh so disclosing sub-fields scrolls the
                // content instead of resizing the sheet (no vaul re-animation jump).
                // Otherwise: fill up to the 92dvh cap but size to content — short
                // forms stay short, tall ones scroll internally.
                ...(stableHeight
                  ? { height: "85dvh" }
                  : { flex: 1, minHeight: 0 }),
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pb: "env(safe-area-inset-bottom)",
                // DialogContent scrolls; DialogActions stay pinned at the bottom.
                // overscrollBehavior: a scroll that hits the top/bottom of the
                // sheet body must die there, never chain to the page behind.
                "& .MuiDialogContent-root": {
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                },
                "& .MuiDialogActions-root": { flexShrink: 0 },
              }}
            >
              {/* Accessible name for the dialog (required by vaul/Radix). The
                  visible title is the DialogTitle inside `children`. */}
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
              {/* `data-vaul-no-drag` on the scrolling body, NOT the whole sheet:
                  vaul's shouldDrag() walks up looking for a scrolled ancestor,
                  but at scrollTop === 0 (i.e. every time the sheet opens) no
                  branch matches and it falls through to "this is a drag" — so
                  the first upward swipe moved the page behind instead of
                  scrolling the sheet. The attribute is checked first and short-
                  circuits that. The handle and title stay outside it, so
                  swipe-down-to-dismiss still works. */}
              <Box
                data-vaul-no-drag
                sx={{ display: "contents" }}
              >
                {/* Menus inside the sheet portal into `sheetEl`, keeping them
                    within vaul's content tree so they stay clickable. */}
                <SheetContainerContext.Provider value={sheetEl}>
                  {children}
                </SheetContainerContext.Provider>
              </Box>
            </Box>
          </Vaul.Content>
        </Vaul.Portal>
      </Vaul.Root>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
      {children}
    </Dialog>
  );
}
