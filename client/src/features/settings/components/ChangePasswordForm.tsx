import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";
import { changePassword } from "../../../lib/api/auth";
import { ApiError } from "../../../lib/api/client";

const MIN_LEN = 8;

// Change-password group in the Security tab. Verifies the current password
// server-side; on success the API swaps in a fresh session so the user stays
// logged in (other devices are logged out).
export function ChangePasswordForm() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ current?: string; next?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Client-side gates (server is the source of truth).
  const tooShort = next.length > 0 && next.length < MIN_LEN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const sameAsCurrent = next.length > 0 && next === current;
  const canSubmit =
    !busy &&
    current.length > 0 &&
    next.length >= MIN_LEN &&
    confirm === next &&
    next !== current;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setToast(t("settings.security.passwordChanged"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setFieldError({ current: t("settings.security.wrongCurrent") });
      } else if (e instanceof ApiError && e.status === 400) {
        setFieldError({ next: t("settings.security.sameAsCurrent") });
      } else {
        setError(t("settings.security.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <GroupLabel>{t("settings.security.password")}</GroupLabel>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Box sx={fieldGrid}>
        <TextField
          label={t("settings.security.currentPassword")}
          type="password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setFieldError(null);
          }}
          fullWidth
          autoComplete="current-password"
          error={!!fieldError?.current}
          helperText={fieldError?.current}
          sx={{ gridColumn: { sm: "1 / -1" } }}
        />
        <TextField
          label={t("settings.security.newPassword")}
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          fullWidth
          autoComplete="new-password"
          error={tooShort || sameAsCurrent || !!fieldError?.next}
          helperText={
            fieldError?.next
              ? fieldError.next
              : tooShort
                ? t("settings.security.passwordTooShort", { min: MIN_LEN })
                : sameAsCurrent
                  ? t("settings.security.sameAsCurrent")
                  : undefined
          }
        />
        <TextField
          label={t("settings.security.confirmPassword")}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          fullWidth
          autoComplete="new-password"
          error={mismatch}
          helperText={mismatch ? t("settings.security.passwordsDontMatch") : undefined}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2.5 }}>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("settings.security.changePassword")}
        </Button>
      </Box>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
