import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import CircularProgress from "@mui/material/CircularProgress";
import { GroupLabel } from "./GroupLabel";
import { ToggleRow } from "./ToggleRow";
import { fieldGrid } from "../constants";
import { useAuth } from "../../../auth/AuthContext";
import { useApi } from "../../../lib/api/useApi";
import {
  updatePreferences,
  getOrganization,
  updateOrganization,
  type Organization,
} from "../api";
import type { AppLanguage } from "../../../i18n";

// Preferences tab. Two independent settings:
//  - Language: PER-USER, persisted server-side (follows the user across devices)
//    and applied immediately client-side.
//  - "Show prices to technicians": ORG-WIDE privacy flag, ADMIN-ONLY. Stored as
//    Organization.hidePricesFromTechnicians (inverted for the UI label).
export function PreferencesForm() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const isAdmin = user?.role === "admin";

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // --- Language (per-user) -------------------------------------------------
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

  // --- Show prices to technicians (org-wide, admin only) -------------------
  // GET /organization is readable by any authed user; we only render + persist
  // the toggle for admins.
  const { data: org, loading: orgLoading } = useApi<Organization>(getOrganization);
  // UI label is "show prices"; storage is the inverse (hide).
  const [showPrices, setShowPrices] = useState(false);
  const [pricesBusy, setPricesBusy] = useState(false);

  useEffect(() => {
    if (org) setShowPrices(!org.hidePricesFromTechnicians);
  }, [org]);

  const togglePrices = async (next: boolean) => {
    setShowPrices(next);
    setPricesBusy(true);
    setError(null);
    try {
      await updateOrganization({ hidePricesFromTechnicians: !next });
      setToast(t("settings.preferences.saved"));
    } catch (e) {
      setShowPrices(!next); // revert on failure
      setError(e instanceof Error ? e.message : t("settings.preferences.saveError"));
    } finally {
      setPricesBusy(false);
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

      {isAdmin ? (
        <>
          <Divider sx={{ my: 3 }} />
          <GroupLabel>{t("settings.preferences.privacy")}</GroupLabel>
          {orgLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <ToggleRow
              label={t("settings.preferences.showPrices.label")}
              sub={t("settings.preferences.showPrices.sub")}
              checked={showPrices}
              onChange={togglePrices}
              disabled={pricesBusy}
            />
          )}
        </>
      ) : null}

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
