import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import { GroupLabel } from "./GroupLabel";
import { fieldGrid } from "../constants";

export function ProfileForm({ name }: { name: string }) {
  const { t } = useTranslation();
  const [first = "Jan", last = "de Vries"] = name.split(" ");
  return (
    <Box>
      {/* Profile photo block */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main", fontWeight: 700, fontSize: 30 }}>
          {(first[0] ?? "") + (last[0] ?? "")}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.25 }}>{t("settings.profile.photo")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settings.profile.photoHint")}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" size="small">{t("settings.profile.changePhoto")}</Button>
            <Button variant="outlined" size="small" color="error">{t("settings.profile.remove")}</Button>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      <GroupLabel>{t("settings.profile.personalData")}</GroupLabel>
      <Box sx={fieldGrid}>
        <TextField label={t("settings.profile.firstName")} defaultValue={first} fullWidth />
        <TextField label={t("settings.profile.lastName")} defaultValue={last} fullWidth />
        <TextField label={t("settings.profile.email")} type="email" defaultValue="jan.devries@werkbonapp.nl" fullWidth sx={{ gridColumn: { sm: "1 / -1" } }} />
        <TextField label={t("settings.profile.phone")} defaultValue="+31 6 12345678" fullWidth />
        <TextField label={t("settings.profile.role")} defaultValue="Admin / Eigenaar" fullWidth />
      </Box>
    </Box>
  );
}
