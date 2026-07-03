import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useForm } from "../../../lib/useForm";
import { required, email as emailRule } from "../../../lib/validation";
import { requestEmailChange } from "../api";

type Form = { newEmail: string; currentPassword: string };
const RULES = { newEmail: [required, emailRule], currentPassword: [required] };

// Changing the login email is a verified, re-authenticated action: enter the new
// address + current password, we email a confirmation link to the new address,
// and the email only switches once that link is clicked.
export function EmailChangeDialog({
  open,
  currentEmail,
  onClose,
}: {
  open: boolean;
  currentEmail: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { values, setField, onBlur, errorFor, isValid, reset, touchAll } =
    useForm<Form>({ newEmail: "", currentPassword: "" }, RULES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    reset({ newEmail: "", currentPassword: "" });
    setError(null);
    setSentTo(null);
  }, [open, reset]);

  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const submit = async () => {
    if (!isValid) {
      touchAll();
      return;
    }
    const target = values.newEmail.trim().toLowerCase();
    if (target === currentEmail.toLowerCase()) {
      setError(t("settings.emailChange.sameEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestEmailChange(target, values.currentPassword);
      setSentTo(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.emailChange.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{t("settings.emailChange.title")}</DialogTitle>
      <DialogContent>
        {sentTo ? (
          // Confirmation-sent state — nothing has changed yet.
          <Alert severity="success" sx={{ mt: 1 }}>
            {t("settings.emailChange.sent", { email: sentTo })}
          </Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("settings.emailChange.subtitle")}
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label={t("settings.emailChange.newEmail")}
              type="email"
              value={values.newEmail}
              onChange={setField("newEmail")}
              onBlur={onBlur("newEmail")}
              disabled={busy}
              size="small"
              autoFocus
              {...err("newEmail")}
            />
            <TextField
              label={t("settings.emailChange.currentPassword")}
              type="password"
              value={values.currentPassword}
              onChange={setField("currentPassword")}
              onBlur={onBlur("currentPassword")}
              disabled={busy}
              size="small"
              autoComplete="current-password"
              {...err("currentPassword")}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {sentTo ? t("common.actions.close") : t("common.actions.cancel")}
        </Button>
        {sentTo ? null : (
          <Button
            variant="contained"
            onClick={submit}
            disabled={busy || !isValid}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t("settings.emailChange.send")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
