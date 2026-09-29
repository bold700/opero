import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PAGE_BG, SECTIONS, type SectionId } from "./constants";
import { PAGE_PADDING_RESPONSIVE } from "../../theme/tokens";
import { SectionList } from "./components/SectionList";
import { SectionPanel } from "./components/SectionPanel";

// Settings (Instellingen) — master/detail.
//
// Desktop (md+): section list beside the form panel, both always visible.
// Mobile: a drill-down — the section list IS the screen, tapping a row replaces
// it with that section's form, and the panel's back arrow returns. This is the
// platform-standard settings pattern; the list scrolls vertically like the rest
// of the app, so nothing (least of all Sign out) is hidden off-screen sideways.
export function Settings() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isAdmin = user?.role === "admin";
  const sections = useMemo(
    () => SECTIONS.filter((s) => !s.adminOnly || isAdmin),
    [isAdmin],
  );
  // On mobile `null` means "showing the list"; on desktop a section is always open.
  const [active, setActive] = useState<SectionId | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const openSection = active ?? "profile";
  const showList = !isMobile || active === null;
  const showPanel = !isMobile || active !== null;

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
          bgcolor: PAGE_BG,
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
          // Clear the fixed mobile bottom nav so the last row stays tappable.
          pb: {
            xs: "calc(72px + env(safe-area-inset-bottom) + 16px)",
            md: PAGE_PADDING_RESPONSIVE.md,
          },
          display: "flex",
          gap: 3,
          flexDirection: { xs: "column", md: "row" },
          alignItems: "flex-start",
        }}
      >
        {showList ? (
          <SectionList
            sections={sections}
            active={openSection}
            onSelect={setActive}
            onLogout={() => setLogoutOpen(true)}
            variant={isMobile ? "drilldown" : "sidebar"}
          />
        ) : null}

        {showPanel ? (
          <SectionPanel
            active={openSection}
            onBack={isMobile ? () => setActive(null) : undefined}
          />
        ) : null}
      </Box>

      <ConfirmDialog
        open={logoutOpen}
        title={t("settings.logout.title")}
        body={t("settings.logout.body")}
        confirmLabel={t("common.actions.logout")}
        busy={loggingOut}
        destructive
        onClose={() => setLogoutOpen(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          await logout();
          // logout() clears tokens + triggers the auth-expired redirect to /login.
        }}
      />
    </Box>
  );
}
