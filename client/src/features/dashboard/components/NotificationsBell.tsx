import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import AlarmOutlinedIcon from "@mui/icons-material/AlarmOutlined";
import ChecklistRtlOutlinedIcon from "@mui/icons-material/ChecklistRtlOutlined";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import type { NotificationCategory } from "@opero/shared";
import {
  getNotifications,
  markNotificationsSeen,
  type NotificationItem,
  type NotificationsResponse,
} from "../../../lib/api/notifications";
import { BottomSheet } from "../../../components/BottomSheet";
import { CARD_SHADOW, HAIRLINE, LAVENDER, RADIUS } from "../../../theme/tokens";

const EMPTY: NotificationsResponse = { items: [], unreadCount: 0, seenAt: null };
const POLL_MS = 60_000;

const CATEGORY_ICON: Record<NotificationCategory, typeof AssignmentOutlinedIcon> = {
  extraWorkApproval: ReceiptLongOutlinedIcon,
  urgentOnSite: WarningAmberOutlinedIcon,
  newWorkOrder: AssignmentOutlinedIcon,
  progressLogged: TimelineOutlinedIcon,
  progressReminder: AlarmOutlinedIcon,
  controlReminder: ChecklistRtlOutlinedIcon,
  mention: AlternateEmailOutlinedIcon,
};

// The scrollable list of notification items — shared by the desktop dropdown and
// the mobile bottom sheet so both stay identical.
function NotificationsList({
  data,
  loading,
  onGo,
}: {
  data: NotificationsResponse;
  loading: boolean;
  onGo: (item: NotificationItem) => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ flex: 1, overflowY: "auto", py: 0.5, minHeight: 0 }}>
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
              onClick={() => onGo(item)}
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
  );
}

// Bell in the dashboard top bar. Shows an unread badge (things newer than the
// user's last look). On desktop it opens an anchored dropdown; on mobile a
// full-width bottom sheet (so it never gets clipped by the narrow header).
// Opening it marks everything seen (clears the badge).
export function NotificationsBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [data, setData] = useState<NotificationsResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const load = async () => {
    try {
      setData(await getNotifications());
    } catch (err) {
      // The UI still degrades quietly (we keep whatever we had rather than
      // flashing an error in the header on one failed poll), but the failure is
      // no longer INVISIBLE: a bare `catch {}` here hid a backend bug that made
      // the feed permanently empty for monteurs, with nothing to see anywhere.
      console.error("[notifications] failed to load", err);
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

  const bell = (
    <IconButton ref={anchorRef} onClick={toggle} aria-label={t("notifications.title")}>
      <Badge badgeContent={data.unreadCount} color="error" max={9}>
        <NotificationsNoneIcon />
      </Badge>
    </IconButton>
  );

  const header = (
    <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t("notifications.title")}</Typography>
    </Box>
  );

  // Mobile: a draggable bottom sheet, full width, so it can never be clipped by
  // the header. The list scrolls internally (scrollableContent), so the sheet
  // itself drags from the handle/header.
  if (isMobile) {
    return (
      <>
        {bell}
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={t("notifications.title")}
          header={header}
          scrollableContent
          maxHeight="80dvh"
        >
          <NotificationsList data={data} loading={loading} onGo={go} />
        </BottomSheet>
      </>
    );
  }

  // Desktop: an anchored dropdown below the bell.
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: "relative" }}>
        {bell}
        {open ? (
          <Box
            sx={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "70dvh",
              display: "flex",
              flexDirection: "column",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: `${RADIUS.card}px`,
              boxShadow: CARD_SHADOW,
              overflow: "hidden",
              zIndex: 20,
            }}
          >
            {header}
            <NotificationsList data={data} loading={loading} onGo={go} />
          </Box>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
}
