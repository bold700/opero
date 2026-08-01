import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

export const MIN_PASSWORD_LENGTH = 8;

// The "choose a password twice" form, shared by the invite and reset pages.
// Only the labels and the submit copy differ between them, so those arrive as
// translation keys rather than the form knowing which flow it is in.
export function SetPasswordForm({
  passwordLabel,
  confirmLabel,
  submitLabel,
  busy,
  onSubmit,
}: {
  passwordLabel: string;
  confirmLabel: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (password: string) => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Only complain once there is something to complain about — an empty field
  // the user hasn't reached yet is not an error.
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !busy && password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(password);
      }}
    >
      <TextField
        label={passwordLabel}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        autoFocus
        autoComplete="new-password"
        error={tooShort}
        helperText={
          tooShort ? t("auth.reset.tooShort", { min: MIN_PASSWORD_LENGTH }) : undefined
        }
      />
      <TextField
        label={confirmLabel}
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
          {busy ? t("auth.submitting") : submitLabel}
        </Button>
      </Box>
    </Stack>
  );
}
