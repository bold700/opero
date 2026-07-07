import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SignaturePad, type SignaturePadHandle } from "../../../components/SignaturePad";
import { useIsMobile } from "../../../lib/useIsMobile";

// Sign-off: the signer types their name AND draws a signature. On confirm we
// POST /finish (multipart) with the signature PNG + the typed name. This locks
// the work order.
export function SignOffDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (signatureImage: Blob, signedByName: string) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [name, setName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const reset = () => {
    setName("");
    setHasInk(false);
    padRef.current?.clear();
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    const blob = await padRef.current?.toBlob();
    if (!blob || !name.trim()) return;
    onConfirm(blob, name.trim());
  };

  const canConfirm = !busy && hasInk && name.trim().length > 0;

  return (
    <ResponsiveDialog open={open} onClose={handleClose} maxWidth="sm" title={t("workOrderDetail.signOff.title")} stableHeight>
      <DialogTitle sx={{ fontWeight: 700 }}>{t("workOrderDetail.signOff.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {t("workOrderDetail.signOff.description")}
        </Typography>

        <TextField
          fullWidth
          label={t("workOrderDetail.signOff.signerLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!isMobile}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            {t("workOrderDetail.signOff.drawLabel")}
          </Typography>
          <Button
            size="small"
            onClick={() => {
              padRef.current?.clear();
              setHasInk(false);
            }}
            disabled={busy || !hasInk}
          >
            {t("workOrderDetail.signOff.clear")}
          </Button>
        </Box>
        <SignaturePad ref={padRef} onChange={setHasInk} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!canConfirm}>
          {t("workOrderDetail.signOff.confirm")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
