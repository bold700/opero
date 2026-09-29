import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import {
  deleteOrganizationLogo,
  uploadOrganizationLogo,
} from "../api";

export function OrganizationLogo({
  initialUrl,
  onError,
  onSaved,
}: {
  initialUrl?: string;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);

  useEffect(() => setLogoUrl(initialUrl), [initialUrl]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const organization = await uploadOrganizationLogo(file);
      setLogoUrl(organization.logoUrl);
      onSaved(t("settings.company.logoSaved"));
    } catch (error) {
      onError(error instanceof Error ? error.message : t("settings.company.logoError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteOrganizationLogo();
      setLogoUrl(undefined);
      onSaved(t("settings.company.logoRemoved"));
    } catch (error) {
      onError(error instanceof Error ? error.message : t("settings.company.logoError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
      <Paper
        variant="outlined"
        sx={{
          width: 160,
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        {logoUrl ? (
          <Box component="img" src={logoUrl} alt={t("settings.company.logoAlt")} sx={{ maxWidth: "90%", maxHeight: "80%" }} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("settings.company.noLogo")}
          </Typography>
        )}
      </Paper>
      <Box>
        <Typography variant="subtitle2">{t("settings.company.logo")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("settings.company.logoHint")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {logoUrl ? t("settings.company.changeLogo") : t("settings.company.uploadLogo")}
          </Button>
          {logoUrl ? (
            <Button size="small" color="inherit" disabled={busy} onClick={remove}>
              {t("common.actions.delete")}
            </Button>
          ) : null}
        </Box>
        <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
      </Box>
    </Box>
  );
}
