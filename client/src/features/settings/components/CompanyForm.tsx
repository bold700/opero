import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import { useForm } from "../../../lib/useForm";
import { email as emailRule } from "../../../lib/validation";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";
import { useApi } from "../../../lib/api/useApi";
import { getOrganization, updateOrganization, type Organization } from "../api";

type Form = {
  name: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  vatNumber: string;
  iban: string;
  bic: string;
  kvkNumber: string;
  website: string;
};

const RULES = { email: [emailRule] };

// Company tab — org details (admin only). Real data, validated, persists via
// PATCH /organization.
export function CompanyForm() {
  const { t } = useTranslation();
  const { data: org, loading } = useApi<Organization>(getOrganization);
  const { values, setField, onBlur, errorFor, isValid, dirty, reset, touchAll } = useForm<Form>(
    {
      name: "",
      email: "",
      address: "",
      postalCode: "",
      city: "",
      phone: "",
      vatNumber: "",
      iban: "",
      bic: "",
      kvkNumber: "",
      website: "",
    },
    RULES,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (org)
      reset({
        name: org.name,
        email: org.email,
        address: org.address,
        postalCode: org.postalCode,
        city: org.city,
        phone: org.phone,
        vatNumber: org.vatNumber,
        iban: org.iban,
        bic: org.bic,
        kvkNumber: org.kvkNumber,
        website: org.website,
      });
  }, [org, reset]);

  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const save = async () => {
    if (!isValid) {
      touchAll();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOrganization(values);
      setToast(t("settings.company.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.company.saveError"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <GroupLabel>{t("settings.company.companyData")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField
          label={t("settings.company.companyName")}
          value={values.name}
          onChange={setField("name")}
          fullWidth
          sx={{ gridColumn: { sm: "1 / -1" } }}
        />
        <TextField
          label={t("settings.company.companyEmail")}
          type="email"
          value={values.email}
          onChange={setField("email")}
          onBlur={onBlur("email")}
          fullWidth
          {...err("email")}
        />
        <TextField
          label={t("settings.company.phone")}
          value={values.phone}
          onChange={setField("phone")}
          fullWidth
        />
        <TextField
          label={t("settings.company.companyAddress")}
          value={values.address}
          onChange={setField("address")}
          fullWidth
          sx={{ gridColumn: { sm: "1 / -1" } }}
        />
        <TextField
          label={t("settings.company.postalCode")}
          value={values.postalCode}
          onChange={setField("postalCode")}
          fullWidth
        />
        <TextField
          label={t("settings.company.city")}
          value={values.city}
          onChange={setField("city")}
          fullWidth
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <GroupLabel>{t("settings.company.billing")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField
          label={t("settings.company.vat")}
          value={values.vatNumber}
          onChange={setField("vatNumber")}
          fullWidth
        />
        <TextField
          label={t("settings.company.kvkNumber")}
          value={values.kvkNumber}
          onChange={setField("kvkNumber")}
          fullWidth
        />
        <TextField
          label={t("settings.company.iban")}
          value={values.iban}
          onChange={setField("iban")}
          fullWidth
        />
        <TextField
          label={t("settings.company.bic")}
          value={values.bic}
          onChange={setField("bic")}
          fullWidth
        />
        <TextField
          label={t("settings.company.website")}
          value={values.website}
          onChange={setField("website")}
          fullWidth
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || !isValid || !dirty}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </Box>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
