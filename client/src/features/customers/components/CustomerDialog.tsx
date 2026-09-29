import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { AccountSection } from "../../users/components/AccountSection";
import { useForm } from "../../../lib/useForm";
import { required, email } from "../../../lib/validation";
import type { Customer, CustomerInput, CustomerType } from "../api";
import { useIsMobile } from "../../../lib/useIsMobile";

// All-string form shape (what the inputs hold).
type Form = {
  name: string;
  type: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
};

const EMPTY: Form = {
  name: "",
  type: "business",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  postalCode: "",
  city: "",
  notes: "",
};

const RULES = {
  name: [required],
  email: [email],
};

// Create / edit a customer. One form for both: pass `customer` to edit, omit to
// create. Name is required; email is validated if present.
export function CustomerDialog({
  open,
  customer,
  busy,
  error,
  canManage,
  canDelete,
  accountBusy,
  isSelf,
  onClose,
  onSubmit,
  onDelete,
  onInvite,
  onResend,
  onDisable,
  onEnable,
}: {
  open: boolean;
  customer?: Customer | null;
  busy: boolean;
  error: string | null;
  canManage: boolean;
  canDelete: boolean;
  accountBusy: boolean;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (input: CustomerInput) => void;
  onDelete: () => void;
  onInvite: () => void;
  onResend: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { values, setField, onBlur, errorFor, isValid, dirty, reset, touchAll } =
    useForm<Form>(EMPTY, RULES);

  // Seed the form when opening (edit → existing values, create → empty).
  useEffect(() => {
    if (!open) return;
    reset(
      customer
        ? {
            name: customer.name,
            type: customer.type,
            contactName: customer.contactName,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            postalCode: customer.postalCode,
            city: customer.city,
            notes: customer.notes ?? "",
          }
        : EMPTY,
    );
  }, [open, customer, reset]);

  // Helper to wire an input to its error key (translated).
  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const handleSave = () => {
    if (!isValid) {
      touchAll();
      return;
    }
    onSubmit({
      name: values.name.trim(),
      type: values.type as CustomerType,
      contactName: values.contactName,
      email: values.email.trim(),
      phone: values.phone,
      address: values.address,
      postalCode: values.postalCode,
      city: values.city,
      notes: values.notes,
    });
  };

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" title={customer ? t("customers.dialog.editTitle") : t("customers.dialog.newTitle")}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {customer ? t("customers.dialog.editTitle") : t("customers.dialog.newTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label={t("customers.dialog.name")}
            value={values.name}
            onChange={setField("name")}
            onBlur={onBlur("name")}
            disabled={busy}
            required
            autoFocus={!isMobile}
            size="small"
            {...err("name")}
          />
          <SelectField
            label={t("customers.dialog.type")}
            value={values.type}
            onChange={(v) => setField("type")({ target: { value: v } })}
            disabled={busy}
            options={[
              { value: "business", label: t("customers.typeBadge.business") },
              { value: "private", label: t("customers.typeBadge.private") },
            ]}
          />
          <TextField
            label={t("customers.dialog.contactName")}
            value={values.contactName}
            onChange={setField("contactName")}
            disabled={busy}
            size="small"
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label={t("customers.dialog.email")}
              value={values.email}
              onChange={setField("email")}
              onBlur={onBlur("email")}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
              {...err("email")}
            />
            <TextField
              label={t("customers.dialog.phone")}
              type="tel"
              value={values.phone}
              onChange={setField("phone")}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
            />
          </Box>
          <TextField
            label={t("customers.dialog.address")}
            value={values.address}
            onChange={setField("address")}
            disabled={busy}
            size="small"
          />
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2 }}>
            <TextField
              label={t("customers.dialog.postalCode")}
              value={values.postalCode}
              onChange={setField("postalCode")}
              disabled={busy}
              size="small"
              sx={{ width: { xs: "100%", sm: 160 } }}
            />
            <TextField
              label={t("customers.dialog.city")}
              value={values.city}
              onChange={setField("city")}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
            />
          </Box>
          <TextField
            label={t("customers.dialog.notes")}
            value={values.notes}
            onChange={setField("notes")}
            disabled={busy}
            size="small"
            multiline
            minRows={2}
          />

          {/* Login account — only for an existing customer, admins only. Reads
              the live email field so a just-typed address enables Uitnodigen
              (the invite is sent against the saved record). */}
          {customer && canManage ? (
            <AccountSection
              account={customer.account}
              email={values.email}
              busy={accountBusy}
              labelKeys="customers.dialog.account"
              isSelf={isSelf}
              onInvite={onInvite}
              onResend={onResend}
              onDisable={onDisable}
              onEnable={onEnable}
            />
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* Destructive action, pushed away from the confirming ones so it can't
            be hit on the way to Opslaan. Only when editing. */}
        {customer && canDelete ? (
          <>
            <Button color="error" onClick={onDelete} disabled={busy}>
              {t("common.actions.delete")}
            </Button>
            <Box sx={{ flex: 1 }} />
          </>
        ) : null}
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        {/* `dirty`, so reopening a record and saving it unchanged isn't offered
            as an action — it would PATCH the same values back. */}
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={busy || !isValid || !dirty}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
