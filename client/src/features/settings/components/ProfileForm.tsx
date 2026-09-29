import { useEffect, useRef, useState } from "react";
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
import { required } from "../../../lib/validation";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";
import { updateProfile, uploadAvatar, deleteAvatar } from "../api";
import { EmailChangeDialog } from "./EmailChangeDialog";
import { SelectField } from "../../../components/SelectField";
import type { UserRole } from "@opero/shared";

// Email is NOT edited here — it's the login identity and changes only via the
// verified email-change flow (dialog → confirmation link). Name/phone save instantly.
type Form = { name: string; phone: string };
const RULES = { name: [required] };

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// The Profile tab — the logged-in user edits their own name / email / phone and
// it persists via PATCH /auth/profile, refreshing the auth context.
export function ProfileForm() {
  const { t } = useTranslation();
  const { user, setUser, switchRole } = useAuth();
  const { values, setField, onBlur, errorFor, isValid, dirty, reset, touchAll } =
    useForm<Form>({ name: "", phone: "" }, RULES);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed from the current user.
  useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? "" });
  }, [user, reset]);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      setUser(await uploadAvatar(file));
      setToast(t("settings.profile.photoSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profile.saveError"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemovePhoto = async () => {
    setPhotoBusy(true);
    setError(null);
    try {
      setUser(await deleteAvatar());
      setToast(t("settings.profile.photoRemoved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.profile.saveError"));
    } finally {
      setPhotoBusy(false);
    }
  };

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
      const updated = await updateProfile({
        name: values.name.trim(),
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

  const changeRole = async (role: string) => {
    if (!user || role === user.role) return;
    setRoleBusy(true);
    setError(null);
    try {
      await switchRole(role as UserRole);
      setToast(t("settings.profile.roleSwitched"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.profile.roleSwitchError"));
    } finally {
      setRoleBusy(false);
    }
  };

  const assignedRoles = user?.roles?.length ? user.roles : user ? [user.role] : [];

  return (
    <Box>
      {/* Profile photo — real upload to object storage. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Avatar
          src={user?.avatarUrl}
          sx={{ width: 88, height: 88, bgcolor: "primary.main", fontWeight: 700, fontSize: 30 }}
        >
          {initials(values.name || user?.name || "")}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.25 }}>{t("settings.profile.photo")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settings.profile.photoHint")}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              startIcon={photoBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              {t("settings.profile.changePhoto")}
            </Button>
            {user?.avatarUrl ? (
              <Button variant="text" size="small" color="inherit" onClick={onRemovePhoto} disabled={photoBusy}>
                {t("settings.profile.remove")}
              </Button>
            ) : null}
          </Box>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickPhoto}
          />
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
          value={user?.email ?? ""}
          fullWidth
          disabled
          slotProps={{
            input: {
              endAdornment: (
                <Button size="small" onClick={() => setEmailDialogOpen(true)}>
                  {t("settings.profile.changeEmail")}
                </Button>
              ),
            },
          }}
        />
        <TextField
          label={t("settings.profile.phone")}
          type="tel"
          value={values.phone}
          onChange={setField("phone")}
          fullWidth
        />
        {assignedRoles.length > 1 ? (
          <SelectField
            label={t("settings.profile.activeRole")}
            value={user?.role ?? ""}
            onChange={(role) => void changeRole(role)}
            disabled={roleBusy}
            options={assignedRoles.map((role) => ({
              value: role,
              label: t(`settings.profile.roles.${role}`),
            }))}
          />
        ) : (
          <TextField
            label={t("settings.profile.role")}
            value={user?.role ? t(`settings.profile.roles.${user.role}`) : ""}
            fullWidth
            disabled
          />
        )}
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

      <EmailChangeDialog
        open={emailDialogOpen}
        currentEmail={user?.email ?? ""}
        onClose={() => setEmailDialogOpen(false)}
      />
    </Box>
  );
}
