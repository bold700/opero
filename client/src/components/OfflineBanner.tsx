import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CloudOffIcon from "@mui/icons-material/CloudOff";

// A slim banner shown while the device is offline. This app is online-only (no
// offline data entry), so instead of silently failing we tell the user clearly.
export function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <Box
      role="status"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        px: 2,
        py: 0.75,
        bgcolor: "#49454F",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <CloudOffIcon fontSize="small" />
      {t("common.offline")}
    </Box>
  );
}
