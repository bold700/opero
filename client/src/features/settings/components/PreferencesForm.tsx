import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import { GroupLabel } from "./GroupLabel";
import { ToggleRow } from "./ToggleRow";
import { fieldGrid } from "../constants";

export function PreferencesForm() {
  const { t } = useTranslation();
  return (
    <Box>
      <GroupLabel>{t("settings.preferences.display")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label={t("settings.preferences.language")} defaultValue="nl" select fullWidth>
          <MenuItem value="nl">{t("settings.preferences.languageDutch")}</MenuItem>
          <MenuItem value="en">{t("settings.preferences.languageEnglish")}</MenuItem>
        </TextField>
        <TextField label={t("settings.preferences.theme")} defaultValue="light" select fullWidth>
          <MenuItem value="light">{t("settings.preferences.themeLight")}</MenuItem>
          <MenuItem value="dark">{t("settings.preferences.themeDark")}</MenuItem>
          <MenuItem value="system">{t("settings.preferences.themeSystem")}</MenuItem>
        </TextField>
      </Box>
      <Divider sx={{ my: 3 }} />
      <GroupLabel>{t("settings.preferences.privacy")}</GroupLabel>
      <ToggleRow
        label={t("settings.preferences.showPrices.label")}
        sub={t("settings.preferences.showPrices.sub")}
        on={false}
      />
    </Box>
  );
}
