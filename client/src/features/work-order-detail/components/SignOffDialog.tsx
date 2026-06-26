import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

// Sign-off: a typed-name confirmation for now (a real signature pad arrives with
// the file-storage phase). On confirm we POST /finish with the typed name.
export function SignOffDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (signature: string) => void;
}) {
  const { t } = useTranslation();
  const [signature, setSignature] = useState("");

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrderDetail.signOff.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {t("workOrderDetail.signOff.description")}
        </Typography>
        <TextField
          fullWidth
          label={t("workOrderDetail.signOff.signerLabel")}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(signature.trim())}
          disabled={busy || !signature.trim()}
        >
          {t("workOrderDetail.signOff.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
