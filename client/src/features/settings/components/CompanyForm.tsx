import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";

export function CompanyForm() {
  const { t } = useTranslation();
  return (
    <Box>
      <GroupLabel>{t("settings.company.companyData")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label={t("settings.company.companyName")} defaultValue="Isolatie BV" fullWidth />
        <TextField label={t("settings.company.companyEmail")} type="email" defaultValue="info@isolatiebv.nl" fullWidth />
        <TextField label={t("settings.company.companyAddress")} defaultValue="Industrieweg 2, Rotterdam" fullWidth sx={{ gridColumn: { sm: "1 / -1" } }} />
      </Box>
      <Divider sx={{ my: 3 }} />
      <GroupLabel>{t("settings.company.billing")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label={t("settings.company.phone")} defaultValue="010 123 4567" fullWidth />
        <TextField label={t("settings.company.vat")} defaultValue="NL001234567B01" fullWidth />
      </Box>
    </Box>
  );
}
