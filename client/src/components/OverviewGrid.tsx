import Box, { type BoxProps } from "@mui/material/Box";
import { SPACING } from "../theme/tokens";

export function OverviewGrid({ children, sx, ...rest }: BoxProps) {
  return (
    <Box
      {...rest}
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        gap: SPACING.sectionGap,
        alignItems: "start",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
