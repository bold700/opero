import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { UserRole } from "@opero/shared";
import { quickCreateActionsForRole, type QuickCreateAction } from "./quickCreate";
import { CARD_SHADOW, LAVENDER, RADIUS, TAP_TARGET } from "../theme/tokens";

// The quick-create menu opened by the "+" FAB. Controlled by the parent
// (anchorEl + onClose). Desktop rail FAB → an anchored popover next to it;
// mobile floating FAB → a bottom sheet (full-width, big tap targets), so it
// never opens cramped/off-screen against the bottom-right corner.
export function QuickCreateMenu({
  anchorEl,
  role,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  role: UserRole;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const actions = quickCreateActionsForRole(role);
  const open = Boolean(anchorEl);

  const pick = (action: QuickCreateAction) => {
    onClose();
    navigate(action.route);
  };

  // Desktop: close on an outside click ourselves (backdrop is disabled so the
  // rail FAB stays interactive). Skipped on mobile (the Drawer owns its backdrop).
  useEffect(() => {
    if (isMobile || !anchorEl) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorEl.contains(target)) return; // the FAB toggles itself
      const paper = document.querySelector(".MuiMenu-paper");
      if (paper && paper.contains(target)) return; // inside the menu
      onClose();
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [isMobile, anchorEl, onClose]);

  const heading = (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "text.secondary",
      }}
    >
      {t("quickCreate.heading")}
    </Typography>
  );

  // ── Mobile: bottom sheet ──
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: `${RADIUS.card}px`,
              borderTopRightRadius: `${RADIUS.card}px`,
              pb: "env(safe-area-inset-bottom)",
            },
          },
        }}
      >
        {/* grab handle */}
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "divider" }} />
        </Box>
        <Box sx={{ px: 2.5, pt: 1.5, pb: 0.5 }}>{heading}</Box>
        <Box sx={{ px: 1.5, pb: 2 }}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Box
                key={action.key}
                role="button"
                onClick={() => pick(action)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  minHeight: TAP_TARGET + 8,
                  px: 2,
                  borderRadius: `${RADIUS.control}px`,
                  cursor: "pointer",
                  "&:active": { bgcolor: LAVENDER },
                }}
              >
                <Box sx={{ color: "primary.main", display: "flex" }}>
                  <Icon />
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 500 }}>
                  {t(`quickCreate.${action.key}`)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Drawer>
    );
  }

  // ── Desktop: anchored popover next to the rail FAB ──
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      hideBackdrop
      disableScrollLock
      slotProps={{
        root: { sx: { pointerEvents: "none" } },
        paper: {
          elevation: 0,
          sx: {
            pointerEvents: "auto",
            ml: 1.5,
            minWidth: 232,
            borderRadius: `${RADIUS.card}px`,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: CARD_SHADOW,
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 24,
              left: -6,
              width: 12,
              height: 12,
              bgcolor: "background.paper",
              borderLeft: "1px solid",
              borderBottom: "1px solid",
              borderColor: "divider",
              transform: "translateY(-50%) rotate(45deg)",
            },
          },
        },
        list: { sx: { py: 0.5 } },
      }}
    >
      <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>{heading}</Box>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <MenuItem
            key={action.key}
            onClick={() => pick(action)}
            sx={{
              mx: 1,
              my: 0.25,
              borderRadius: `${RADIUS.control}px`,
              py: 1,
              "&:hover": { bgcolor: LAVENDER },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}>
              {t(`quickCreate.${action.key}`)}
            </ListItemText>
          </MenuItem>
        );
      })}
    </Menu>
  );
}
