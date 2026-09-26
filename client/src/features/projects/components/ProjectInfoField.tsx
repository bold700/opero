import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { SPACING } from "../../../theme/tokens";

export function ProjectInfoField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.fieldLabelGap }}>
      <Typography
        variant="overline"
        sx={{
          color: "text.secondary",
          fontWeight: 700,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}
