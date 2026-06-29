import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { UserRole } from "@opero/shared";
import { quickCreateActionsForRole } from "./quickCreate";
import { CARD_SHADOW, LAVENDER, RADIUS } from "../theme/tokens";

// The quick-create menu opened by the "+" FAB. Controlled by the parent
// (anchorEl + onClose) so the desktop rail FAB and the mobile add button drive
// the same menu. Each item navigates to its feature with ?create=1, which makes
// that page open its create dialog. Styled to match the app's M3 card language
// (soft shadow, lavender hover, purple icons) and anchored to the right of the
// FAB so it reads as one connected unit.
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
  const actions = quickCreateActionsForRole(role);

  // With the backdrop disabled (so the FAB stays interactive), close on an
  // outside click ourselves — but ignore clicks on the FAB (it toggles itself)
  // and on the menu Paper (handled by item selection).
  useEffect(() => {
    if (!anchorEl) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorEl.contains(target)) return; // the FAB toggles itself
      const paper = document.querySelector(".MuiMenu-paper");
      if (paper && paper.contains(target)) return; // inside the menu
      onClose();
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [anchorEl, onClose]);

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      // Don't trap pointer events behind a full-screen backdrop — that would
      // make the FAB underneath un-hoverable while the menu is open. Disable the
      // backdrop and let events pass through the root; the menu Paper re-enables
      // them for its own items. Closing still works via: the FAB re-click toggle,
      // Escape, selecting an item, and the outside-click handler below.
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
            // Little arrow pointing back at the FAB. The menu top is aligned with
            // the FAB top, so the FAB's centre sits ~24px down — point there.
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
      <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
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
      </Box>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <MenuItem
            key={action.key}
            onClick={() => {
              onClose();
              navigate(action.route);
            }}
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
            <ListItemText
              slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}
            >
              {t(`quickCreate.${action.key}`)}
            </ListItemText>
          </MenuItem>
        );
      })}
    </Menu>
  );
}
