import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import type { NotificationCategory } from "@opero/shared";
import {
  getNotifications,
  markNotificationsSeen,
  type NotificationItem,
  type NotificationsResponse,
} from "../../../lib/api/notifications";
import { CARD_SHADOW, HAIRLINE, LAVENDER, RADIUS } from "../../../theme/tokens";

const EMPTY: NotificationsResponse = { items: [], unreadCount: 0, seenAt: null };
const POLL_MS = 60_000;

const CATEGORY_ICON: Record<NotificationCategory, typeof AssignmentOutlinedIcon> = {
  extraWorkApproval: ReceiptLongOutlinedIcon,
  urgentOnSite: WarningAmberOutlinedIcon,
  newWorkOrder: AssignmentOutlinedIcon,
};

// Bell in the dashboard top bar. Shows an unread badge (things newer than the
// user's last look) and a dropdown of derived action items. Opening it marks
// everything seen (clears the badge). Role/pref filtering happens server-side.
export function NotificationsBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<NotificationsResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const load = async () => {
    try {
      setData(await getNotifications());
    } catch {
      /* keep whatever we had; the bell degrades quietly */
    }
  };

  // Initial load + light polling so the badge stays current.
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    await load();
    setLoading(false);
    // Opening clears the badge: mark seen, then optimistically zero the count.
    try {
      await markNotificationsSeen();
      setData((d) => ({ ...d, unreadCount: 0 }));
    } catch {
      /* ignore */
    }
  };

  const go = (item: NotificationItem) => {
    setOpen(false);
    navigate(item.route);
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: "relative" }}>
        <IconButton
          ref={anchorRef}
          onClick={toggle}
          aria-label={t("notifications.title")}
        >
          <Badge badgeContent={data.unreadCount} color="error" max={9}>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>

        {open ? (
          <Box
            sx={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: `${RADIUS.card}px`,
              boxShadow: CARD_SHADOW,
              overflow: "hidden",
              zIndex: 20,
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {t("notifications.title")}
              </Typography>
            </Box>

            <Box sx={{ maxHeight: 400, overflowY: "auto", py: 0.5 }}>
              {loading && data.items.length === 0 ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={22} />
                </Box>
              ) : data.items.length === 0 ? (
                <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("notifications.empty")}
                  </Typography>
                </Box>
              ) : (
                data.items.map((item) => {
                  const Icon = CATEGORY_ICON[item.category];
                  return (
                    <Box
                      key={item.id}
                      role="button"
                      onClick={() => go(item)}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        mx: 1,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: `${RADIUS.control}px`,
                        cursor: "pointer",
                        "&:hover": { bgcolor: LAVENDER },
                      }}
                    >
                      <Icon
                        fontSize="small"
                        sx={{
                          mt: 0.25,
                          flexShrink: 0,
                          color: item.category === "urgentOnSite" ? "warning.main" : "primary.main",
                        }}
                      />
                      <Typography sx={{ fontSize: 14, lineHeight: 1.4 }}>
                        {t(item.messageKey, item.params as Record<string, unknown>)}
                      </Typography>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
}
