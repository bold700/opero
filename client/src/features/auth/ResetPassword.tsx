import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { BrandPanel } from "./components/BrandPanel";
import { AuthPanel } from "./components/AuthPanel";
import { resetPassword } from "../../lib/api/auth";
import { ApiError } from "../../lib/api/client";

const MIN_LEN = 8;

// Set a new password from the emailed reset link (?token=...). On success all
// sessions were revoked server-side; the user logs in fresh.
export function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  // Invite links (?invite=1) reuse this page but read as "set up your account"
  // rather than "reset your password".
  const invite = params.get("invite") === "1";
  const ns = invite ? "auth.invite" : "auth.reset";

  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LEN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = !busy && next.length >= MIN_LEN && confirm === next;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, next);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setError(t("auth.reset.invalidLink"));
      } else {
        setError(t("auth.reset.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    // No token in the URL → the link is malformed.
    if (!token) {
      return (
        <Stack spacing={2}>
          <Alert severity="error">{t("auth.reset.invalidLink")}</Alert>
          <Link component={RouterLink} to="/forgot-password" underline="hover" sx={{ color: "primary.main", fontWeight: 500 }}>
            {t("auth.reset.requestNew")}
          </Link>
        </Stack>
      );
    }
    if (done) {
      return (
        <Stack spacing={2}>
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            {t(`${ns}.done`)}
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            {t("auth.reset.goToLogin")}
          </Button>
        </Stack>
      );
    }
    return (
      <Stack
        component="form"
        spacing={2}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error ? (
          <Alert severity="error">
            {error}
            {error === t("auth.reset.invalidLink") ? (
              <>
                {" "}
                <Link component={RouterLink} to="/forgot-password" underline="hover">
                  {t("auth.reset.requestNew")}
                </Link>
              </>
            ) : null}
          </Alert>
        ) : null}
        <TextField
          label={t("auth.reset.newPassword")}
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          fullWidth
          autoFocus
          autoComplete="new-password"
          error={tooShort}
          helperText={tooShort ? t("auth.reset.tooShort", { min: MIN_LEN }) : undefined}
        />
        <TextField
          label={t("auth.reset.confirmPassword")}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          fullWidth
          autoComplete="new-password"
          error={mismatch}
          helperText={mismatch ? t("auth.reset.dontMatch") : undefined}
        />
        <Box sx={{ pt: 1 }}>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {busy ? t("auth.submitting") : t(`${ns}.submit`)}
          </Button>
        </Box>
      </Stack>
    );
  };

  return (
    <Box sx={{ height: "100dvh", overflowY: "auto", display: "flex", flexDirection: { xs: "column", md: "row" } }}>
      <BrandPanel />
      <AuthPanel title={t(`${ns}.title`)} subtitle={t(`${ns}.subtitle`)}>
        {body()}
      </AuthPanel>
    </Box>
  );
}
