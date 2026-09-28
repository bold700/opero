import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { ResponsiveDialog } from "./ResponsiveDialog";
import { useForm } from "../lib/useForm";
import { email, phone } from "../lib/validation";

export type ContactPersonDraft = {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
};

const EMPTY: ContactPersonDraft = {
  firstName: "",
  lastName: "",
  role: "",
  email: "",
  phone: "",
  notes: "",
};

// Every field is optional because the office may initially know only a name,
// phone number, or email address. Filled contact fields still need a valid
// format. The shared zod schema enforces the same rules server-side.
const RULES = {
  email: [email],
  phone: [phone],
};

// Create / edit one contact person: first + last name side by side, role,
// email, phone, notes. Pass `initial` to edit. Shared by every place a
// contact is created or edited, so the form never drifts.
export function ContactPersonDialog({
  open,
  initial,
  busy,
  error,
  errorAction,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: ContactPersonDraft | null;
  busy: boolean;
  error?: string | null;
  errorAction?: { label: string; onClick: () => void };
  onClose: () => void;
  onSave: (draft: ContactPersonDraft) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(initial);
  const { values, setField, onBlur, errorFor, isValid, dirty, reset, touchAll } =
    useForm<ContactPersonDraft>(EMPTY, RULES);

  // Seed when opening (edit → existing values, create → empty).
  useEffect(() => {
    if (open) reset(initial ?? EMPTY);
  }, [open, initial, reset]);

  // Wire an input to its translated error, as the other dialogs do.
  const err = (key: keyof ContactPersonDraft) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const handleSave = () => {
    if (!isValid) {
      touchAll();
      return;
    }
    onSave(values);
  };

  const title = editing ? t("customers.contacts.editTitle") : t("customers.contacts.newTitle");

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" title={title}>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? (
            <Alert
              severity="warning"
              action={
                errorAction ? (
                  <Button color="inherit" size="small" onClick={errorAction.onClick} disabled={busy}>
                    {errorAction.label}
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          ) : null}
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
            <TextField
              label={t("customers.contacts.firstName")}
              value={values.firstName}
              onChange={setField("firstName")}
              onBlur={onBlur("firstName")}
              disabled={busy}
              autoFocus
              size="small"
              fullWidth
              {...err("firstName")}
            />
            <TextField
              label={t("customers.contacts.lastName")}
              value={values.lastName}
              onChange={setField("lastName")}
              onBlur={onBlur("lastName")}
              disabled={busy}
              size="small"
              fullWidth
              {...err("lastName")}
            />
          </Box>
          <TextField
            label={t("customers.contacts.role")}
            value={values.role}
            onChange={setField("role")}
            disabled={busy}
            size="small"
            fullWidth
          />
          <TextField
            label={t("customers.contacts.email")}
            type="email"
            value={values.email}
            onChange={setField("email")}
            onBlur={onBlur("email")}
            disabled={busy}
            size="small"
            fullWidth
            {...err("email")}
          />
          <TextField
            label={t("customers.contacts.phone")}
            type="tel"
            value={values.phone}
            onChange={setField("phone")}
            onBlur={onBlur("phone")}
            disabled={busy}
            size="small"
            fullWidth
            {...err("phone")}
          />
          <TextField
            label={t("customers.contacts.notes")}
            value={values.notes}
            onChange={setField("notes")}
            disabled={busy}
            multiline
            minRows={2}
            size="small"
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        {/* `dirty` on edit, like the customer dialog: reopening a contact and
            saving it unchanged is not offered as an action. */}
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !isValid || (editing && !dirty)}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
