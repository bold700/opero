import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuth } from "../../../auth/AuthContext";
import { useForm } from "../../../lib/useForm";
import { required, email as emailRule } from "../../../lib/validation";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";
import { updateProfile } from "../api";

type Form = { name: string; email: string; phone: string };
const RULES = { name: [required], email: [required, emailRule] };

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// The Profile tab — the logged-in user edits their own name / email / phone and
// it persists via PATCH /auth/profile, refreshing the auth context.
export function ProfileForm() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { values, setField, onBlur, errorFor, isValid, reset, touchAll } = useForm<Form>(
    { name: "", email: "", phone: "" },
    RULES,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Seed from the current user.
  useEffect(() => {
    if (user) reset({ name: user.name, email: user.email, phone: user.phone ?? "" });
  }, [user, reset]);

  const err = (key: keyof Form) => {
    const k = errorFor(key);
    return { error: !!k, helperText: k ? t(k) : undefined };
  };

  const dirty =
    !!user &&
    (values.name !== user.name ||
      values.email !== user.email ||
      values.phone !== (user.phone ?? ""));

  const save = async () => {
    if (!isValid) {
      touchAll();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateProfile({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      });
      setUser(updated); // top bar / avatar refresh immediately
      setToast(t("settings.profile.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.profile.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      {/* Profile photo — needs file storage; disabled for now */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main", fontWeight: 700, fontSize: 30 }}>
          {initials(values.name || user?.name || "")}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.25 }}>{t("settings.profile.photo")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settings.profile.photoComingSoon")}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" size="small" disabled>{t("settings.profile.changePhoto")}</Button>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <GroupLabel>{t("settings.profile.personalData")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField
          label={t("settings.profile.name")}
          value={values.name}
          onChange={setField("name")}
          onBlur={onBlur("name")}
          fullWidth
          required
          sx={{ gridColumn: { sm: "1 / -1" } }}
          {...err("name")}
        />
        <TextField
          label={t("settings.profile.email")}
          type="email"
          value={values.email}
          onChange={setField("email")}
          onBlur={onBlur("email")}
          fullWidth
          required
          {...err("email")}
        />
        <TextField
          label={t("settings.profile.phone")}
          value={values.phone}
          onChange={setField("phone")}
          fullWidth
        />
        <TextField
          label={t("settings.profile.role")}
          value={user?.role ? t(`settings.profile.roles.${user.role}`) : ""}
          fullWidth
          disabled
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
