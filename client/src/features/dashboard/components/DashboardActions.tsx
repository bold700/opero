import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../auth/AuthContext";
import { LAVENDER } from "../../../theme/tokens";

// Right-side actions in the dashboard top bar: search, notifications, avatar.
export function DashboardActions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const initials = (user?.name ?? "JD")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <>
      <IconButton aria-label={t("dashboard.actions.search")}>
        <SearchIcon />
      </IconButton>
      <IconButton aria-label={t("dashboard.actions.notifications")}>
        <Badge badgeContent={0} color="error">
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>
      <Avatar sx={{ width: 36, height: 36, bgcolor: LAVENDER, color: "primary.main", fontSize: 13, fontWeight: 700 }}>
        {initials}
      </Avatar>
    </>
  );
}
