import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { HAIRLINE } from "../../../theme/tokens";
import { activityText, formatDateTime } from "../constants";
import type { Activity } from "../api";

// The audit trail: the project's chronological activity log (newest first).
export function ActivityPanel({ activity }: { activity: Activity[] }) {
  const { t } = useTranslation();
  const rows = [...activity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Card noPadding>
      {/* Fixed header */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("workOrderDetail.activity.title")}
        </Typography>
      </Box>

      {/* On mobile the card GROWS and the page scrolls it (no scroll-within-scroll);
          on desktop it's a bounded panel that scrolls internally beside the rest. */}
      {rows.length === 0 ? (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 4, color: "text.secondary" }}>
          {t("workOrderDetail.activity.empty")}
        </Box>
      ) : (
        <Box sx={{ maxHeight: { xs: "none", md: 420 }, overflowY: { xs: "visible", md: "auto" } }}>
          {rows.map((a) => (
            <Box
              key={a.id}
              sx={{ px: { xs: 2, md: 3 }, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, "&:last-child": { borderBottom: 0 } }}
            >
              <Typography variant="body2">{activityText(t, a)}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {a.userName ? `${a.userName} · ` : ""}
                {formatDateTime(a.createdAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
}
