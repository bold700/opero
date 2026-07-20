import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LogoutIcon from "@mui/icons-material/Logout";
import { HAIRLINE, LAVENDER, LAVENDER_HOVER, TAP_TARGET } from "../../../theme/tokens";
import { cardSx, type SectionId } from "../constants";
import type { SvgIconComponent } from "@mui/icons-material";

type Section = { id: SectionId; icon: SvgIconComponent; adminOnly?: boolean };

// The settings section list (the "master" half of the master/detail).
//
// Mobile renders it as a full-width drill-down list — the platform-standard
// settings pattern (tap a row, the form takes over the screen, back returns).
// Desktop renders the same rows as a persistent sidebar with the active row
// highlighted. Sign out is the last row either way, so it is always visible
// without scrolling sideways and always in the same predictable place.
export function SectionList({
  sections,
  active,
  onSelect,
  onLogout,
  variant,
}: {
  sections: Section[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
  onLogout: () => void;
  variant: "drilldown" | "sidebar";
}) {
  const { t } = useTranslation();
  const drilldown = variant === "drilldown";

  const rows = (
    <>
      {sections.map((s, i) => {
        const Icon = s.icon;
        // Only the sidebar tracks a selection — in the drill-down the list and
        // the form are never on screen together, so nothing is "current".
        const selected = !drilldown && s.id === active;
        return (
          <Box
            key={s.id}
            component="button"
            type="button"
            onClick={() => onSelect(s.id)}
            sx={{
              // Reset the native button so it lays out like a list row.
              appearance: "none",
              font: "inherit",
              textAlign: "left",
              width: "100%",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: drilldown ? 2 : 1.5,
              py: 1.5,
              minHeight: TAP_TARGET,
              cursor: "pointer",
              borderRadius: drilldown ? 0 : 2,
              bgcolor: selected ? LAVENDER : "transparent",
              borderBottom: drilldown && i < sections.length - 1 ? `1px solid ${HAIRLINE}` : "none",
              "&:hover": { bgcolor: selected ? LAVENDER : LAVENDER_HOVER },
            }}
          >
            <Icon fontSize="small" sx={{ color: selected ? "primary.main" : "text.secondary" }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: selected ? "primary.main" : "text.primary" }}>
                {t(`settings.sections.${s.id}.title`)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {t(`settings.sections.${s.id}.subtitle`)}
              </Typography>
            </Box>
            {/* The chevron is the affordance that says "this opens a screen". */}
            {drilldown ? <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled" }} /> : null}
          </Box>
        );
      })}
    </>
  );

  const logoutRow = (
    <Box
      component="button"
      type="button"
      onClick={onLogout}
      sx={{
        appearance: "none",
        font: "inherit",
        textAlign: "left",
        width: "100%",
        border: drilldown ? "none" : "1px solid",
        borderColor: drilldown ? "transparent" : "error.main",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: drilldown ? 2 : 1.5,
        py: 1.5,
        minHeight: TAP_TARGET,
        cursor: "pointer",
        borderRadius: drilldown ? 0 : 2,
        bgcolor: "transparent",
        color: "error.main",
        "&:hover": { bgcolor: "#FDF2F2" },
      }}
    >
      <LogoutIcon fontSize="small" />
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: "error.main" }}>
        {t("common.actions.logout")}
      </Typography>
    </Box>
  );

  if (!drilldown) {
    return (
      <Box sx={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {rows}
        <Box sx={{ mt: 1 }}>{logoutRow}</Box>
      </Box>
    );
  }

  // Mobile: two grouped cards (sections, then the account action) — the
  // standard "settings groups" shape, and it keeps Sign out visually separate
  // so it can't be tapped by accident while scanning the list.
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
      <Paper elevation={0} sx={{ ...cardSx, overflow: "hidden" }}>
        {rows}
      </Paper>
      <Paper elevation={0} sx={{ ...cardSx, overflow: "hidden" }}>
        {logoutRow}
      </Paper>
    </Box>
  );
}
