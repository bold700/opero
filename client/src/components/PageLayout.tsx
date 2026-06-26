import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { SURFACE, SPACING } from "../theme/tokens";

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
        px: SPACING.pagePadding,
        py: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {actions ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>{actions}</Box>
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
          p: SPACING.pagePadding,
          display: "flex",
          flexDirection: "column",
          gap: SPACING.sectionGap,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
