import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { LAVENDER } from "../../../theme/tokens";
import { SearchField } from "./SearchField";
import { NotificationsBell } from "./NotificationsBell";

// Right-side actions in the dashboard top bar: inline search, notifications, avatar.
export function DashboardActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initials = (user?.name ?? "JD")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <>
      <SearchField />
      <NotificationsBell />
      <Tooltip title={t("nav.settings")}>
        <IconButton
          onClick={() => navigate("/settings")}
          aria-label={t("nav.settings")}
          sx={{ p: 0 }}
        >
          <Avatar src={user?.avatarUrl} sx={{ width: 36, height: 36, bgcolor: LAVENDER, color: "primary.main", fontSize: 13, fontWeight: 700 }}>
            {initials}
          </Avatar>
        </IconButton>
      </Tooltip>
    </>
  );
}
