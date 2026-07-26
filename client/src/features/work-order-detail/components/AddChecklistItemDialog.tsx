import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { useIsMobile } from "../../../lib/useIsMobile";

// Add a one-off pre-job checklist item — the same add flow as a task line
// (a button opens a dialog to type it), instead of an inline field sitting in
// the card. Keeps the "add" affordance consistent across the werkbon.
export function AddChecklistItemDialog({
  open,
  busy,
  onClose,
  onAdd,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onAdd: (label: string) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [label, setLabel] = useState("");

  // Reset the field each time the dialog opens.
  useEffect(() => {
    if (open) setLabel("");
  }, [open]);

  const trimmed = label.trim();
  const submit = () => {
    if (!trimmed) return;
    onAdd(trimmed);
    onClose();
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      title={t("workOrderDetail.prejob.addItemTitle")}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {t("workOrderDetail.prejob.addItemTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            label={t("workOrderDetail.prejob.addItemLabel")}
            placeholder={t("workOrderDetail.prejob.addItemPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            disabled={busy}
            autoFocus={!isMobile}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={submit}
          disabled={busy || !trimmed}
        >
          {t("workOrderDetail.prejob.addItem")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
