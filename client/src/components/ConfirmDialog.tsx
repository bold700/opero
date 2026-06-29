import { useTranslation } from "react-i18next";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

// Shared yes/no confirmation (used for deletes etc.). Title + body are passed in
// already-translated; the action buttons use common.actions keys.
export function ConfirmDialog({
  open,
  title,
  body,
  busy = false,
  destructive = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body?: string;
  busy?: boolean;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      {body ? (
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {body}
          </Typography>
        </DialogContent>
      ) : null}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          color={destructive ? "error" : "primary"}
          onClick={onConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {destructive ? t("common.actions.delete") : t("common.actions.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
