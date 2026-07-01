import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { login as apiLogin, loginWith2fa } from "../../../lib/api/auth";
import { ApiError } from "../../../lib/api/client";

// Right-side login form. Wired to POST /api/auth/login. Demo accounts:
// admin@opero.test / technician@opero.test / client@opero.test, password "opero123".
export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // When set, the account has 2FA on and we're on the code-entry step.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiLogin(account.trim(), password);
      if ("mfaRequired" in res) {
        // 2FA is on — switch to the code-entry step.
        setMfaToken(res.mfaToken);
        return;
      }
      setUser(res.user);
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError(t("auth.errors.invalidCredentials"));
      } else {
        setError(t("auth.errors.loginFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode() {
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginWith2fa(mfaToken, code.trim());
      setUser(user);
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Bad code, or the short-lived mfaToken expired.
        setError(t("auth.twoFactor.invalidCode"));
      } else {
        setError(t("auth.errors.loginFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function backToLogin() {
    setMfaToken(null);
    setCode("");
    setError(null);
  }

  const clearAdornment = (value: string, clear: () => void) =>
    value ? (
      <InputAdornment position="end">
        <IconButton aria-label={t("auth.clear")} edge="end" onClick={clear} size="small">
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
          {mfaToken ? t("auth.twoFactor.title") : t("auth.welcomeBack")}
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 3.5 }}>
          {mfaToken ? t("auth.twoFactor.subtitle") : t("auth.subtitle")}
        </Typography>

        {mfaToken ? (
          <Stack
            component="form"
            spacing={2}
            sx={{ width: "100%" }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerifyCode();
            }}
          >
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label={t("auth.twoFactor.codeLabel")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              fullWidth
              autoFocus
              inputMode="numeric"
              slotProps={{ htmlInput: { maxLength: 6, autoComplete: "one-time-code" } }}
            />
            <Box sx={{ pt: 1, display: "flex", gap: 1.5, alignItems: "center" }}>
              <Button type="submit" variant="contained" disabled={submitting || code.length < 6}>
                {submitting ? t("auth.submitting") : t("auth.twoFactor.verify")}
              </Button>
              <Link
                component="button"
                type="button"
                onClick={backToLogin}
                underline="hover"
                sx={{ color: "primary.main", fontWeight: 500, fontSize: 14 }}
              >
                {t("auth.twoFactor.back")}
              </Link>
            </Box>
          </Stack>
        ) : (
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
              label={t("auth.fields.email")}
              type="email"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              fullWidth
              autoFocus
              slotProps={{ input: { endAdornment: clearAdornment(account, () => setAccount("")) } }}
            />
            <TextField
              label={t("auth.fields.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              slotProps={{ input: { endAdornment: clearAdornment(password, () => setPassword("")) } }}
            />

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FormControlLabel
                control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                label={t("auth.rememberMe")}
              />
              <Link
                component={RouterLink}
                to="/forgot-password"
                underline="hover"
                sx={{ color: "primary.main", fontWeight: 500, fontSize: 14 }}
              >
                {t("auth.forgotPassword")}
              </Link>
            </Box>

            <Box sx={{ pt: 1 }}>
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? t("auth.submitting") : t("auth.submit")}
              </Button>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
