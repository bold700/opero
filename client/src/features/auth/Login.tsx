import Box from "@mui/material/Box";
import { BrandPanel } from "./components/BrandPanel";
import { LoginForm } from "./components/LoginForm";

// WerkbonApp login. Matches the M3 login mockup: lavender brand panel left,
// form right. Wired to POST /api/auth/login. Demo accounts: admin@opero.test /
// monteur@opero.test / klant@opero.test, password "opero123".
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
