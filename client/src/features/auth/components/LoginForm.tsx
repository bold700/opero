import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import CancelIcon from "@mui/icons-material/Cancel";
import Alert from "@mui/material/Alert";
import { useAuth } from "../../../auth/AuthContext";
import { login as apiLogin } from "../../../lib/api/auth";
import { ApiError } from "../../../lib/api/client";

// Right-side login form. Wired to POST /api/auth/login. Demo accounts:
// admin@opero.test / monteur@opero.test / klant@opero.test, password "opero123".
export function LoginForm() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiLogin(account.trim(), password);
      if ("mfaRequired" in res) {
        // 2FA enabled for this account — a code step would go here (later).
        setError("2FA is vereist voor dit account (nog niet ondersteund).");
        return;
      }
      setUser(res.user);
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Onjuiste inloggegevens.");
      } else {
        setError("Inloggen mislukt. Probeer het opnieuw.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const clearAdornment = (value: string, clear: () => void) =>
    value ? (
      <InputAdornment position="end">
        <IconButton aria-label="wissen" edge="end" onClick={clear} size="small">
          <CancelIcon fontSize="small" />
        </IconButton>
      </InputAdornment>
    ) : null;

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
          Welkom terug
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 3.5 }}>
          Log in op uw account
        </Typography>

        <Stack
          component="form"
          spacing={2}
          sx={{ width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="E-mailadres"
            type="email"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            fullWidth
            autoFocus
            slotProps={{ input: { endAdornment: clearAdornment(account, () => setAccount("")) } }}
          />
          <TextField
            label="Wachtwoord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            slotProps={{ input: { endAdornment: clearAdornment(password, () => setPassword("")) } }}
          />

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <FormControlLabel
              control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
              label="Onthoud mij"
            />
            <Link href="#" underline="hover" sx={{ color: "primary.main", fontWeight: 500, fontSize: 14 }}>
              Wachtwoord vergeten?
            </Link>
          </Box>

          <Box sx={{ pt: 1 }}>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Bezig..." : "Inloggen"}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
