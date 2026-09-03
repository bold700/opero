import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import { GroupLabel } from "./GroupLabel";
import { ToggleRow } from "./ToggleRow";
import { useAuth } from "../../../auth/AuthContext";
import { useDirty } from "../../../lib/isDirty";
import type { NotificationPrefs } from "../../../lib/api/auth";
import { updatePreferences } from "../api";

// The notification keys, in display order. Each maps to
// settings.notifications.<key>.{label,sub} translations.
const KEYS: (keyof NotificationPrefs)[] = [
  "newWorkOrder",
  "urgentOnSite",
  "extraWorkApproval",
  "progressLogged",
  "progressReminder",
  "weeklySummary",
];

// Notifications tab — per-user toggles, persisted server-side via
// PATCH /auth/preferences so they follow the user across devices.
export function NotificationsForm() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    () => user!.preferences.notifications,
  );
  // The saved state to compare against. Unlike the dialogs there is no reopen
  // to re-seed from, so this is advanced by hand once a save succeeds —
  // otherwise Save would stay enabled forever after the first one.
  const savedPrefs = useRef<NotificationPrefs>(user!.preferences.notifications);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const set = (key: keyof NotificationPrefs) => (next: boolean) =>
    setPrefs((p) => ({ ...p, [key]: next }));

  const dirty = useDirty(prefs, savedPrefs.current);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updatePreferences({ notifications: prefs });
      setUser(updated);
      savedPrefs.current = updated.preferences.notifications;
      setToast(t("settings.notifications.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.notifications.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <GroupLabel>{t("settings.notifications.preferences")}</GroupLabel>
      <Box>
        {KEYS.map((key, i) => (
          <Box key={key}>
            <ToggleRow
              label={t(`settings.notifications.${key}.label`)}
              sub={t(`settings.notifications.${key}.sub`)}
              checked={prefs[key]}
              onChange={set(key)}
            />
            {i < KEYS.length - 1 ? <Divider /> : null}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || !dirty}
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
