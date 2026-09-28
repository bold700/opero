import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { SPACING } from "../../../theme/tokens";

export function FormSectionLabel({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: SPACING.itemGap }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          flexShrink: 0,
        }}
      >
        {children}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
  );
}
