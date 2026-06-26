import Box from "@mui/material/Box";
import { BrandPanel } from "./components/BrandPanel";
import { LoginForm } from "./components/LoginForm";

// Login screen. Matches the M3 login mockup: lavender brand panel left,
// form right. Wired to POST /api/auth/login. Demo accounts: admin@opero.test /
// technician@opero.test / client@opero.test, password "opero123".
export function Login() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: { xs: "column", md: "row" } }}>
      {/* Left: solid lavender brand panel (full-bleed) */}
      <BrandPanel />

      {/* Right: login form (full-bleed, centered, left-aligned) */}
      <LoginForm />
    </Box>
  );
}
