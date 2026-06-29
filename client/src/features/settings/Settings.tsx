import { useState } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../auth/AuthContext";
import { PAGE_BG, cardSx, SECTIONS, type SectionId } from "./constants";
import { ProfileForm } from "./components/ProfileForm";
import { CompanyForm } from "./components/CompanyForm";
import { NotificationsForm } from "./components/NotificationsForm";
import { PreferencesForm } from "./components/PreferencesForm";

// Settings (Instellingen) — M3 master/detail. A slim labeled section list +
// a structured form panel. Demo data; wires to /api/settings + /api/auth/me.
export function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const sections = useMemo(
    () => SECTIONS.filter((s) => !s.adminOnly || isAdmin),
    [isAdmin],
  );
  const [active, setActive] = useState<SectionId>("profile");

  return (
    <Box sx={{ bgcolor: PAGE_BG, minHeight: "100dvh" }}>
      {/* Page header */}
      <Box sx={{ px: 4, py: 3, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t("settings.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.subtitle")}
        </Typography>
      </Box>

      <Box sx={{ p: 4, display: "flex", gap: 3, flexDirection: { xs: "column", md: "row" }, alignItems: "flex-start" }}>
        {/* Section list (master) */}
        <Box sx={{ width: { xs: "100%", md: 260 }, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {sections.map((s) => {
            const selected = s.id === active;
            const Icon = s.icon;
            return (
              <Box
                key={s.id}
                onClick={() => setActive(s.id)}
                role="button"
                sx={{
                  display: "flex",
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  cursor: "pointer",
                  bgcolor: selected ? "#E8DEF8" : "transparent",
                  "&:hover": { bgcolor: selected ? "#E8DEF8" : "#EFECF2" },
                }}
              >
                <Icon fontSize="small" sx={{ mt: 0.25, color: selected ? "primary.main" : "text.secondary" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, color: selected ? "primary.main" : "text.primary" }}>
                    {t(`settings.sections.${s.id}.title`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`settings.sections.${s.id}.subtitle`)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Form panel (detail) */}
        <Paper elevation={0} sx={{ ...cardSx, flex: 1, minWidth: 0, width: "100%", overflow: "hidden" }}>
          {/* Panel header */}
          <Box sx={{ px: 3, py: 2.5, borderBottom: "1px solid", borderColor: "#F0EDF1" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t(`settings.sections.${active}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`settings.sections.${active}.subtitle`)}
            </Typography>
          </Box>

          {/* Panel body — each tab owns its own save action. */}
          <Box sx={{ p: 3 }}>
            {active === "profile" && <ProfileForm />}
            {active === "company" && <CompanyForm />}
            {active === "notifications" && <NotificationsForm />}
            {active === "preferences" && <PreferencesForm />}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
