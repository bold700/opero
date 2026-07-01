import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// The right-side form panel shell shared by login / forgot / reset pages, so all
// three sit in the same frame with the same title/subtitle rhythm.
export function AuthPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: "#FCF9FE",
        display: "flex",
        alignItems: "center",
        justifyContent: { xs: "center", md: "flex-start" },
        px: { xs: 3, md: 10 },
        py: { xs: 6, md: 4 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Typography variant="h4" sx={{ fontWeight: 400, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 3.5 }}>
          {subtitle}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}
