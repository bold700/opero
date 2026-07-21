import { useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";
import { useAuth } from "../../../auth/AuthContext";
import { updatePreferences } from "../api";
import type { AppLanguage } from "../../../i18n";

// Preferences tab. Language is PER-USER, persisted server-side (follows the
// user across devices) and applied immediately client-side.
//
// There used to be a "show prices to technicians" org toggle here. It is gone
// on purpose: technicians NEVER see prices — an absolute rule from the client,
// not a preference (see canSeePrices in @opero/shared).
export function PreferencesForm() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [language, setLanguage] = useState<AppLanguage>(user!.preferences.language);
  const [langBusy, setLangBusy] = useState(false);

  const changeLanguage = async (next: AppLanguage) => {
    if (next === language) return;
    setLanguage(next);
    setLangBusy(true);
    setError(null);
    try {
      // Apply immediately for instant feedback, then persist server-side.
      await i18n.changeLanguage(next);
      const updated = await updatePreferences({ language: next });
      setUser(updated);
      setToast(t("settings.preferences.saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.preferences.saveError"));
    } finally {
      setLangBusy(false);
    }
  };

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <GroupLabel>{t("settings.preferences.display")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField
          label={t("settings.preferences.language")}
          value={language}
          onChange={(e) => changeLanguage(e.target.value as AppLanguage)}
          select
          fullWidth
          disabled={langBusy}
        >
          <MenuItem value="nl">{t("settings.preferences.languageDutch")}</MenuItem>
          <MenuItem value="en">{t("settings.preferences.languageEnglish")}</MenuItem>
        </TextField>
      </Box>

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
