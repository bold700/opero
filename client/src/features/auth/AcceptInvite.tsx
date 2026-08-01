import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { BrandPanel } from "./components/BrandPanel";
import { AuthPanel } from "./components/AuthPanel";
import { SetPasswordForm } from "./components/SetPasswordForm";
import { acceptInvite } from "../../lib/api/auth";
import { ApiError } from "../../lib/api/client";

// Accept an invitation (?token=… from the invite email): choose a first
// password, which activates the account.
//
// This is its own page and its own endpoint rather than a flag on the reset
// page. Someone opening it has never seen the product, so the framing is
// "welcome, set up your account" — and a dead link here means "ask for a new
// invitation", not "request a password reset" for an account that isn't active.
export function AcceptInvite() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (password: string) => {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token, password);
      setDone(true);
    } catch (e) {
      // 400 covers every dead-link case the server won't distinguish between
      // (unknown, expired, already used) — deliberately, so this page can't be
      // used to probe which invitations exist.
      setError(
        e instanceof ApiError && e.status === 400
          ? t("auth.invite.invalidLink")
          : t("auth.invite.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (!token) {
      return (
        <Stack spacing={2}>
          <Alert severity="error">{t("auth.invite.invalidLink")}</Alert>
          <Alert severity="info">{t("auth.invite.expiredHelp")}</Alert>
        </Stack>
      );
    }
    if (done) {
      return (
        <Stack spacing={2}>
          <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
            {t("auth.invite.done")}
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            {t("auth.reset.goToLogin")}
          </Button>
        </Stack>
      );
    }
    return (
      <Stack spacing={2}>
        {error ? (
          <Stack spacing={1}>
            <Alert severity="error">{error}</Alert>
            {error === t("auth.invite.invalidLink") ? (
              <Alert severity="info">{t("auth.invite.expiredHelp")}</Alert>
            ) : null}
          </Stack>
        ) : null}
        <SetPasswordForm
          passwordLabel={t("auth.invite.newPassword")}
          confirmLabel={t("auth.invite.confirmPassword")}
          submitLabel={t("auth.invite.submit")}
          busy={busy}
          onSubmit={(password) => void submit(password)}
        />
      </Stack>
    );
  };

  return (
    <Box
      sx={{
        height: "100dvh",
        overflowY: "auto",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <BrandPanel />
      <AuthPanel title={t("auth.invite.title")} subtitle={t("auth.invite.subtitle")}>
        {body()}
      </AuthPanel>
    </Box>
  );
}
