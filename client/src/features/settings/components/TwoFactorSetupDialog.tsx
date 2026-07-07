import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { setup2fa, enable2fa, type TwoFactorSetup } from "../../../lib/api/auth";
import { HAIRLINE, RADIUS } from "../../../theme/tokens";
import { useIsMobile } from "../../../lib/useIsMobile";

// Enable-2FA flow: on open, call setup (get QR + secret), user scans it in their
// authenticator app, enters the 6-digit code to confirm. onDone fires after a
// successful enable so the parent can refresh the user.
export function TwoFactorSetupDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch a fresh pending secret + QR each time the dialog opens.
  useEffect(() => {
    if (!open) {
      setSetupData(null);
      setCode("");
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setup2fa()
      .then(setSetupData)
      .catch((e) => setError(e instanceof Error ? e.message : t("settings.security.error")))
      .finally(() => setLoading(false));
  }, [open, t]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await enable2fa(code.trim());
      onDone();
    } catch {
      setError(t("settings.security.invalidCode"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" title={t("settings.security.setupTitle")}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("settings.security.setupTitle")}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : setupData ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.security.setupStep1")}
            </Typography>

            {/* QR from the server (data URL) */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              <Box
                component="img"
                src={setupData.qrDataUrl}
                alt=""
                sx={{ width: 176, height: 176, borderRadius: `${RADIUS.control}px`, border: `1px solid ${HAIRLINE}` }}
              />
            </Box>

            {/* Manual-entry secret fallback */}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              {t("settings.security.manualEntry")}
            </Typography>
            <Box
              sx={{
                fontFamily: "monospace",
                fontSize: 13,
                letterSpacing: 1,
                bgcolor: "action.hover",
                borderRadius: `${RADIUS.control}px`,
                px: 1.5,
                py: 1,
                mb: 2.5,
                wordBreak: "break-all",
              }}
            >
              {setupData.secret}
            </Box>

            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("settings.security.setupStep2")}
            </Typography>
            <TextField
              label={t("settings.security.codeLabel")}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              fullWidth
              autoFocus={!isMobile}
              inputMode="numeric"
              slotProps={{ htmlInput: { maxLength: 6, autoComplete: "one-time-code" } }}
            />
          </Box>
        ) : (
          <Alert severity="error">{error ?? t("settings.security.error")}</Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={confirm}
          disabled={busy || !setupData || code.length < 6}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("settings.security.enable")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
