import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// Temporary stand-in for screens not yet rebuilt to the M3 Figma. Each route
// gets a real page incrementally (Dashboard first, then Work orders, ...).
export function Placeholder({ title }: { title: string }) {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 400, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        This screen is not built yet.
      </Typography>
    </Box>
  );
}
