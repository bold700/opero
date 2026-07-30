import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Fab from "@mui/material/Fab";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AddIcon from "@mui/icons-material/Add";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { useAuth } from "../auth/AuthContext";
import { navItemsForRole, type NavItem } from "./navigation";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { quickCreateActionsForRole } from "./quickCreate";
import { BottomSheet } from "../components/BottomSheet";
import { OfflineBanner } from "../components/OfflineBanner";

const RAIL_WIDTH = 96;

///  M3 navigation rail (desktop) — matches the purple Figma: hamburger, FAB,
// icon+label destinations, settings/profile pinned to the bottom.
function NavRail({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [createAnchor, setCreateAnchor] = useState<HTMLElement | null>(null);

  const role = user?.role ?? "client";
  const canCreate = quickCreateActionsForRole(role).length > 0;
  const settingsItem = items.find((i) => i.path === "/settings");
  const primary = items.filter((i) => i.path !== "/settings");

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Paper
      elevation={0}
      square
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        // Fills the fixed shell frame; the rail itself never scrolls with content.
        height: "100%",
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        alignItems: "center",
        py: 2,
        bgcolor: "#FFFFFF",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Logo mark → back to dashboard. Matches the login page: white rounded
          square with black bars. */}
      <Box
        onClick={() => navigate("/")}
        role="button"
        aria-label={t("nav.dashboard")}
        sx={{
          width: 44,
          height: 44,
          borderRadius: "14px",
          bgcolor: "#FFFFFF",
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-end" }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 4,
                height: i === 1 ? 20 : 16,
                bgcolor: "#1D1B20",
                borderRadius: 0.5,
                transform: i === 0 ? "skewX(-8deg)" : i === 2 ? "skewX(8deg)" : "none",
              }}
            />
          ))}
        </Box>
      </Box>

      {canCreate ? (
        <>
          <Fab
            color="primary"
            size="medium"
            aria-label={t("quickCreate.heading")}
            onClick={(e) => setCreateAnchor((a) => (a ? null : e.currentTarget))}
            sx={{
              mb: 2,
              boxShadow: "none",
              transition: "transform .2s ease, background-color .2s ease",
              transform: createAnchor ? "rotate(45deg)" : "none",
              "&:hover": { boxShadow: "none" },
            }}
          >
            <AddIcon />
          </Fab>
          <QuickCreateMenu
            anchorEl={createAnchor}
            role={role}
            onClose={() => setCreateAnchor(null)}
          />
        </>
      ) : null}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: 1 }}>
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Box
              key={item.path}
              onClick={() => navigate(item.path)}
              role="button"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                width: RAIL_WIDTH - 16,
                py: 0.5,
                cursor: "pointer",
                color: active ? "primary.main" : "text.secondary",
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 32,
                  borderRadius: 100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: active ? "#E8DEF8" : "transparent",
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: active ? 600 : 400, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}
              >
                {t(item.labelKey)}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {settingsItem ? (
        <Box
          onClick={() => navigate("/settings")}
          role="button"
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            cursor: "pointer",
            color: isActive("/settings") ? "primary.main" : "text.secondary",
            mb: 1,
          }}
        >
          <settingsItem.icon fontSize="small" />
          <Typography variant="caption">{t(settingsItem.labelKey)}</Typography>
        </Box>
      ) : null}
    </Paper>
  );
}

// M3 bottom navigation (mobile). Shows the top destinations for the role, plus a
// floating quick-create button above the bar.
const MORE = "__more__";

function BottomNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [createAnchor, setCreateAnchor] = useState<HTMLElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const role = user?.role ?? "client";
  const canCreate = quickCreateActionsForRole(role).length > 0;

  // Long Dutch labels ("Werkbonnen", "Instellingen") + 5 tabs overflow a narrow
  // phone. Show at most 4 direct tabs; if there are more destinations, the 4th
  // slot becomes a "More" menu holding the rest — so nothing is unreachable.
  const primary = items.length <= 5 ? items.slice(0, 5) : items.slice(0, 4);
  const overflow = items.length <= 5 ? [] : items.slice(4);

  const activePath = (i: NavItem) =>
    i.path === "/" ? location.pathname === "/" : location.pathname.startsWith(i.path);
  const inOverflow = overflow.some(activePath);
  const currentPrimary = primary.find(activePath);
  // Highlight "More" when the active route lives inside the overflow menu.
  const value = inOverflow ? MORE : (currentPrimary?.path ?? false);

  return (
    <Box sx={{ display: { xs: "block", md: "none" } }}>
      {canCreate ? (
        <>
          <Fab
            color="primary"
            aria-label={t("quickCreate.heading")}
            onClick={(e) => setCreateAnchor((a) => (a ? null : e.currentTarget))}
            sx={{
              position: "fixed",
              bottom: "calc(80px + env(safe-area-inset-bottom))",
              right: 16,
              zIndex: 1101,
              transition: "transform .2s ease",
              transform: createAnchor ? "rotate(45deg)" : "none",
            }}
          >
            <AddIcon />
          </Fab>
          <QuickCreateMenu
            anchorEl={createAnchor}
            role={role}
            onClose={() => setCreateAnchor(null)}
          />
        </>
      ) : null}
      <Paper
        elevation={3}
        square
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          pb: "env(safe-area-inset-bottom)", // iOS home indicator
        }}
      >
        <BottomNavigation
          value={value}
          showLabels
          sx={{
            // Tighten so up-to-5 slots + long Dutch labels fit ~360px without
            // clipping: no forced min-width, smaller ellipsised label.
            "& .MuiBottomNavigationAction-root": { minWidth: 0, px: 0.5 },
            "& .MuiBottomNavigationAction-label": {
              fontSize: 11,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }}
        >
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <BottomNavigationAction
                key={item.path}
                label={t(item.labelKey)}
                value={item.path}
                icon={<Icon />}
                onClick={() => navigate(item.path)}
              />
            );
          })}
          {overflow.length > 0 ? (
            <BottomNavigationAction
              key={MORE}
              value={MORE}
              label={t("nav.more")}
              icon={<MoreHorizIcon />}
              onClick={() => setMoreOpen(true)}
            />
          ) : null}
        </BottomNavigation>
      </Paper>

      {/* Overflow destinations — a draggable bottom sheet, consistent with the
          app's other mobile overlays (quick-create, notifications). */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("nav.more")}>
        <Box sx={{ px: 1.5, pt: 1, pb: 2 }}>
          {overflow.map((item) => {
            const Icon = item.icon;
            const active = activePath(item);
            return (
              <Box
                key={item.path}
                role="button"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.path);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  minHeight: 52,
                  px: 2,
                  borderRadius: 2,
                  cursor: "pointer",
                  color: active ? "primary.main" : "text.primary",
                  bgcolor: active ? "#E8DEF8" : "transparent",
                  "&:active": { bgcolor: active ? "#E8DEF8" : "#EFECF2" },
                }}
              >
                <Icon fontSize="small" sx={{ color: active ? "primary.main" : "text.secondary" }} />
                <Typography sx={{ fontSize: 16, fontWeight: active ? 600 : 500 }}>
                  {t(item.labelKey)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </BottomSheet>
    </Box>
  );
}

// The authenticated app chrome: nav rail (desktop) / bottom nav (mobile) + page.
//
// The shell is a FIXED FRAME the exact height of the (dynamic) viewport: the nav
// rail / bottom nav are pinned, and `<main>` is the ONE scroll region. Because the
// document itself never scrolls, the sticky page header and the fixed bottom nav
// can't jump when iOS shows/hides its URL bar — only the content between them moves.
export function AppShell() {
  const { user } = useAuth();
  const items = user ? navItemsForRole(user.role) : [];
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement | null>(null);

  // The document no longer scrolls (the inner <main> does), so the browser's
  // automatic scroll-to-top on navigation doesn't apply — reset it ourselves on
  // each route change so a new page opens at the top, not where the last one was.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <Box
      sx={{
        display: "flex",
        height: "100dvh",
        maxWidth: "100%",
        overflow: "hidden", // frame doesn't scroll; the inner <main> does
        bgcolor: "background.default",
      }}
    >
      <NavRail items={items} />
      <Box
        component="main"
        ref={mainRef}
        sx={{
          flex: 1,
          minWidth: 0,
          height: "100%", // exactly fills the 100dvh frame (single dvh source)
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden", // pages own their scroll (PageLayout scrolls content)
        }}
      >
        <OfflineBanner />
        <Outlet />
      </Box>
      <BottomNav items={items} />
    </Box>
  );
}
