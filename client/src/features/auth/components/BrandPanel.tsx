import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

// Left brand panel of the login screen: solid lavender, logo glyph + wordmark.
export function BrandPanel() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: "#E6DFF5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        px: 4,
        py: { xs: 8, md: 4 },
      }}
    >
      <Box
        sx={{
          width: 104,
          height: 104,
          borderRadius: "28px",
          bgcolor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
        }}
      >
        {/* Logo glyph — three bars */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 11,
                height: i === 1 ? 48 : 40,
                bgcolor: "#1D1B20",
                borderRadius: 0.75,
                transform: i === 0 ? "skewX(-8deg)" : i === 2 ? "skewX(8deg)" : "none",
              }}
            />
          ))}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
        <Typography sx={{ fontSize: 40, fontWeight: 400, color: "#1D1B20", letterSpacing: "-0.5px" }}>
          {t("auth.brand.name")}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 400, color: "text.secondary" }}>
          {t("auth.brand.tagline")}
        </Typography>
      </Box>
    </Box>
  );
}
