import Box from "@mui/material/Box";
import { BrandPanel } from "./components/BrandPanel";
import { LoginForm } from "./components/LoginForm";

// Opero login screen: lavender brand panel left, form right.
// Wired to POST /api/auth/login.
export function Login() {
  return (
    <Box sx={{ height: "100dvh", overflowY: "auto", display: "flex", flexDirection: { xs: "column", md: "row" } }}>
      {/* Left: solid lavender brand panel (full-bleed) */}
      <BrandPanel />

      {/* Right: login form (full-bleed, centered, left-aligned) */}
      <LoginForm />
    </Box>
  );
}
