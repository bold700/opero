import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { HAIRLINE } from "../../../theme/tokens";
import { cardSx, type SectionId } from "../constants";
import { ProfileForm } from "./ProfileForm";
import { CompanyForm } from "./CompanyForm";
import { NotificationsForm } from "./NotificationsForm";
import { PreferencesForm } from "./PreferencesForm";
import { SecurityForm } from "./SecurityForm";

// The form panel (the "detail" half of the master/detail). Each section owns its
// own save action; this only supplies the header and picks the form.
//
// `onBack` is passed on mobile, where the panel replaces the list and needs a way
// back. On desktop the list is always on screen, so it is omitted.
export function SectionPanel({
  active,
  onBack,
}: {
  active: SectionId;
  onBack?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Paper elevation={0} sx={{ ...cardSx, flex: 1, minWidth: 0, width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 2, md: 3 },
          py: 2.5,
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        {onBack ? (
          <IconButton edge="start" onClick={onBack} aria-label={t("common.actions.back")} sx={{ mr: 0.5 }}>
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t(`settings.sections.${active}.title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`settings.sections.${active}.subtitle`)}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {active === "profile" && <ProfileForm />}
        {active === "company" && <CompanyForm />}
        {active === "notifications" && <NotificationsForm />}
        {active === "preferences" && <PreferencesForm />}
        {active === "security" && <SecurityForm />}
      </Box>
    </Paper>
  );
}
