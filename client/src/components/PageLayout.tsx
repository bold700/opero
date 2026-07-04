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
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        position: "sticky",
        top: 0,
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
  return (
    <Box sx={{ bgcolor: SURFACE, minHeight: "100dvh" }}>
      <TopBar title={title} actions={actions} />
      <Box
        sx={{
          p: PAGE_PADDING_RESPONSIVE,
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
