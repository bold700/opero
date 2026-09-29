import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { SURFACE, SPACING, PAGE_PADDING_RESPONSIVE } from "../theme/tokens";

// The standard page chrome every screen uses, so spacing is identical and tabs
// don't jump:
//  - grey page surface
//  - a sticky top bar (title left, actions right)
//  - consistent content padding + section gap
//
// Usage:
//   <PageLayout title={t("workOrders.title")} actions={<Button>…</Button>}>
//     ...sections...
//   </PageLayout>

export function TopBar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        // The header is a STATIC, non-scrolling row at the top of the page frame
        // (PageLayout scrolls its content below, not this bar) — so it never
        // shifts or jitters on iOS momentum scroll. `flexShrink: 0` keeps it from
        // being squeezed by the scroll area.
        flexShrink: 0,
        minHeight: 64,
        px: PAGE_PADDING_RESPONSIVE,
        py: 1.5,
        display: "flex",
        // On phones the actions drop to their own full-width row under the title
        // (consistent across every screen); on sm+ they sit inline on the right.
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        gap: { xs: 1.5, sm: 2 },
        bgcolor: SURFACE,
        zIndex: 10,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, flexShrink: 0 }}>
        {title}
      </Typography>
      {actions ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end", // primary action always pins right
            gap: 1.5,
            // Fill the row on mobile so search grows and the action sits on the
            // right — same layout on every screen.
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}

export function PageLayout({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  // The page is a fixed-height frame: a static header on top + a single scroll
  // region below it. Only the content scrolls; the header is a flex sibling
  // OUTSIDE the scroller, so it physically cannot move on scroll (no sticky, no
  // jitter). Fills the shell's <main> height via 100%.
  return (
    <Box
      sx={{
        bgcolor: SURFACE,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <TopBar title={title} actions={actions} />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          overscrollBehavior: "contain",
          p: PAGE_PADDING_RESPONSIVE,
          // Clear the mobile bottom nav + iOS home indicator so the last row
          // isn't hidden behind the fixed nav (main no longer pads for it).
          pb: {
            xs: "calc(72px + env(safe-area-inset-bottom) + 16px)",
            md: PAGE_PADDING_RESPONSIVE.md,
          },
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, md: SPACING.sectionGap },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
