import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import TuneIcon from "@mui/icons-material/Tune";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

// Settings (Instellingen) — local display data + style constants. Demo data;
// wires to /api/settings + /api/auth/me.

export const PAGE_BG = "#F5F5F5";

export const cardSx = {
  bgcolor: "#FFFFFF",
  borderRadius: 2,
  boxShadow: "0px 1px 2px rgba(0,0,0,0.04), 0px 4px 12px rgba(0,0,0,0.04)",
} as const;

export const fieldGrid = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
  gap: 2,
} as const;

export type SectionId = "profile" | "company" | "notifications" | "preferences" | "security";

// Section list — labels are translated at the call site via t("settings.sections.<id>.*").
export const SECTIONS: { id: SectionId; icon: SvgIconComponent; adminOnly?: boolean }[] = [
  { id: "profile", icon: PersonOutlineIcon },
  { id: "company", icon: BusinessOutlinedIcon, adminOnly: true },
  { id: "notifications", icon: NotificationsNoneIcon },
  { id: "preferences", icon: TuneIcon },
  { id: "security", icon: LockOutlinedIcon },
];
