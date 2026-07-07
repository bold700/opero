import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { useAuth } from "../../../auth/AuthContext";
import { me as fetchMe, disable2fa } from "../../../lib/api/auth";
import { GroupLabel } from "./GroupLabel";
import { TwoFactorSetupDialog } from "./TwoFactorSetupDialog";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { useIsMobile } from "../../../lib/useIsMobile";

// Security tab — two-factor authentication (TOTP). Reflects user.totpEnabled;
// enabling opens the QR/code dialog, disabling requires the account password.
// After either, refetch /me so totpEnabled updates app-wide.
export function SecurityForm() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { user, setUser } = useAuth();
  const enabled = user?.totpEnabled ?? false;

  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = async () => setUser(await fetchMe());

  const onEnabled = async () => {
    setSetupOpen(false);
    await refresh();
    setToast(t("settings.security.enabledToast"));
  };

  const confirmDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      await disable2fa(password);
      setDisableOpen(false);
      setPassword("");
      await refresh();
      setToast(t("settings.security.disabledToast"));
    } catch {
      setError(t("settings.security.wrongPassword"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <GroupLabel>{t("settings.security.twoFactor")}</GroupLabel>

      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <ShieldOutlinedIcon sx={{ color: enabled ? "success.main" : "text.secondary", mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontWeight: 600 }}>
              {t("settings.security.twoFactorTitle")}
            </Typography>
            {enabled ? (
              <Chip
                size="small"
                color="success"
                icon={<CheckCircleOutlineIcon />}
                label={t("settings.security.on")}
              />
            ) : null}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {enabled ? t("settings.security.onDescription") : t("settings.security.offDescription")}
          </Typography>

          {enabled ? (
            <Button variant="outlined" color="inherit" size="small" onClick={() => setDisableOpen(true)}>
              {t("settings.security.disable")}
            </Button>
          ) : (
            <Button variant="contained" size="small" onClick={() => setSetupOpen(true)}>
              {t("settings.security.enable")}
            </Button>
          )}
        </Box>
      </Box>

      {/* Change password */}
      <ChangePasswordForm />

      {/* Enable flow */}
      <TwoFactorSetupDialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onDone={onEnabled}
      />

      {/* Disable flow — requires the account password */}
      <ResponsiveDialog open={disableOpen} onClose={busy ? undefined : () => setDisableOpen(false)} maxWidth="xs" title={t("settings.security.disableTitle")}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t("settings.security.disableTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("settings.security.disableDescription")}
          </Typography>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          <TextField
            label={t("settings.security.passwordLabel")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoFocus={!isMobile}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDisableOpen(false)} disabled={busy}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDisable}
            disabled={busy || !password}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t("settings.security.disable")}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
