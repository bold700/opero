import { useState } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../auth/AuthContext";
import { PAGE_BG, cardSx, SECTIONS, type SectionId } from "./constants";
import { PAGE_PADDING_RESPONSIVE, TAP_TARGET } from "../../theme/tokens";
import { ProfileForm } from "./components/ProfileForm";
import { CompanyForm } from "./components/CompanyForm";
import { NotificationsForm } from "./components/NotificationsForm";
import { PreferencesForm } from "./components/PreferencesForm";
import { SecurityForm } from "./components/SecurityForm";

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
    <Box
      sx={{
        bgcolor: PAGE_BG,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Page header — static, never scrolls (matches PageLayout). */}
      <Box
        sx={{
          flexShrink: 0,
          px: PAGE_PADDING_RESPONSIVE,
          py: 3,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t("settings.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.subtitle")}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          p: PAGE_PADDING_RESPONSIVE,
          pb: { xs: "calc(72px + env(safe-area-inset-bottom) + 16px)", md: PAGE_PADDING_RESPONSIVE.md },
          display: "flex",
          gap: 3,
          flexDirection: { xs: "column", md: "row" },
          alignItems: "flex-start",
        }}
      >
        {/* Section list (master). Vertical list on desktop; a horizontal
            scrollable chip rail on mobile so the panel stays near the top. */}
        <Box
          sx={{
            width: { xs: "100%", md: 260 },
            flexShrink: 0,
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            gap: { xs: 1, md: 0.5 },
            overflowX: { xs: "auto", md: "visible" },
            pb: { xs: 1, md: 0 },
            // Hide the scrollbar on the mobile rail but keep it scrollable.
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
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
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.5,
                  minHeight: { xs: TAP_TARGET, md: "auto" },
                  borderRadius: 2,
                  cursor: "pointer",
                  flexShrink: 0,
                  // On mobile a chip is a single line; on desktop it stacks title + subtitle.
                  whiteSpace: { xs: "nowrap", md: "normal" },
                  bgcolor: selected ? "#E8DEF8" : "transparent",
                  border: { xs: "1px solid", md: "none" },
                  borderColor: { xs: selected ? "primary.main" : "divider", md: "transparent" },
                  "&:hover": { bgcolor: selected ? "#E8DEF8" : "#EFECF2" },
                }}
              >
                <Icon fontSize="small" sx={{ mt: { xs: 0, md: 0.25 }, color: selected ? "primary.main" : "text.secondary" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, color: selected ? "primary.main" : "text.primary" }}>
                    {t(`settings.sections.${s.id}.title`)}
                  </Typography>
                  {/* Subtitle is noise in the mobile chip rail — desktop only. */}
                  <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
                    {t(`settings.sections.${s.id}.subtitle`)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Form panel (detail). No height cap / inner scroll — it grows and the
            page's single scroll region (above) handles it. overflow:visible so
            nothing at the bottom (Role field, Save) can be clipped. */}
        <Paper elevation={0} sx={{ ...cardSx, flex: 1, minWidth: 0, width: "100%" }}>
          {/* Panel header */}
          <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5, borderBottom: "1px solid", borderColor: "#F0EDF1" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t(`settings.sections.${active}.title`)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`settings.sections.${active}.subtitle`)}
            </Typography>
          </Box>

          {/* Panel body — each tab owns its own save action. */}
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {active === "profile" && <ProfileForm />}
            {active === "company" && <CompanyForm />}
            {active === "notifications" && <NotificationsForm />}
            {active === "preferences" && <PreferencesForm />}
            {active === "security" && <SecurityForm />}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
