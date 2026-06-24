import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Fab from "@mui/material/Fab";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuth } from "../auth/AuthContext";
import { navItemsForRole, type NavItem } from "./navigation";

const RAIL_WIDTH = 80;

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// M3 navigation rail (desktop) — matches the purple Figma: hamburger, FAB,
// icon+label destinations, settings/profile pinned to the bottom.
function NavRail({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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
        height: "100dvh",
        position: "sticky",
        top: 0,
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
        aria-label="dashboard"
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

      <Fab color="primary" size="medium" aria-label="nieuw" sx={{ mb: 2, boxShadow: "none" }}>
        <AddIcon />
      </Fab>

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
              <Typography variant="caption" sx={{ fontWeight: active ? 600 : 400 }}>
                {item.label}
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
          <Typography variant="caption">{settingsItem.label}</Typography>
        </Box>
      ) : null}

      {user ? <ProfileMenu name={user.name} onLogout={logout} onSettings={() => navigate("/settings")} /> : null}
    </Paper>
  );
}

// Avatar at the rail bottom; clicking it opens a small M3 menu (profile/settings/
// logout). Keeps the rail clean — no standalone logout button.
function ProfileMenu({
  name,
  onLogout,
  onSettings,
}: {
  name: string;
  onLogout: () => void;
  onSettings: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ p: 0 }} aria-label="profiel">
        <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", fontSize: 14, fontWeight: 600 }}>
          {initials(name)}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: 2, mt: -1 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{name}</Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onSettings();
          }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Instellingen</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onLogout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Uitloggen</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

// M3 bottom navigation (mobile). Shows the top destinations for the role.
function BottomNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const shown = items.filter((i) => i.path !== "/settings").slice(0, 5);
  const current = shown.find((i) =>
    i.path === "/" ? location.pathname === "/" : location.pathname.startsWith(i.path),
  );

  return (
    <Paper
      elevation={3}
      square
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: { xs: "block", md: "none" },
        zIndex: 1100,
      }}
    >
      <BottomNavigation
        value={current?.path ?? "/"}
        onChange={(_e, value) => navigate(value)}
        showLabels
      >
        {shown.map((item) => {
          const Icon = item.icon;
          return (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={<Icon />}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}

// The authenticated app chrome: nav rail (desktop) / bottom nav (mobile) + page.
export function AppShell() {
  const { user } = useAuth();
  const items = user ? navItemsForRole(user.role) : [];

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <NavRail items={items} />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          pb: { xs: 9, md: 0 }, // room for mobile bottom nav
        }}
      >
        <Outlet />
      </Box>
      <BottomNav items={items} />
    </Box>
  );
}
