import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { BrandPanel } from "./components/BrandPanel";
import { AuthPanel } from "./components/AuthPanel";
import { forgotPassword } from "../../lib/api/auth";

// Request a password-reset link. Always shows a generic success (the API returns
// 204 regardless of whether the email exists — no account enumeration).
export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError(t("auth.forgot.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: { xs: "column", md: "row" } }}>
      <BrandPanel />
      <AuthPanel title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
        {sent ? (
          <Stack spacing={2}>
            <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
              {t("auth.forgot.sent")}
            </Alert>
            <Link component={RouterLink} to="/login" underline="hover" sx={{ color: "primary.main", fontWeight: 500 }}>
              {t("auth.forgot.backToLogin")}
            </Link>
          </Stack>
        ) : (
          <Stack
            component="form"
            spacing={2}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label={t("auth.fields.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoFocus
              autoComplete="email"
            />
            <Box sx={{ pt: 1, display: "flex", gap: 1.5, alignItems: "center" }}>
              <Button type="submit" variant="contained" disabled={busy || !email.trim()}>
                {busy ? t("auth.submitting") : t("auth.forgot.send")}
              </Button>
              <Link component={RouterLink} to="/login" underline="hover" sx={{ color: "primary.main", fontWeight: 500, fontSize: 14 }}>
                {t("auth.forgot.backToLogin")}
              </Link>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t("auth.forgot.hint")}
            </Typography>
          </Stack>
        )}
      </AuthPanel>
    </Box>
  );
}
