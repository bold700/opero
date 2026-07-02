import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../components/Card";
import { LAVENDER, RADIUS } from "../../../theme/tokens";
import type { ReportsData } from "../api";
import { formatDate } from "../constants";

// Recent work orders in the selected period — real, each linking to its detail.
export function RecentWorkOrders({
  workOrders,
}: {
  workOrders: ReportsData["recentWorkOrders"];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t("reports.recentWorkOrders.title")}
      </Typography>
      <Box>
        {workOrders.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            {t("reports.recentWorkOrders.empty")}
          </Typography>
        ) : (
          workOrders.map((w, i) => (
            <Box key={w.id}>
              <Box
                role="button"
                onClick={() => navigate(`/work-orders/${w.id}`)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 1.5,
                  px: 1,
                  mx: -1,
                  borderRadius: `${RADIUS.control}px`,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: LAVENDER, color: "primary.main" }}>
                  <AssignmentIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
                    {w.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {w.customer} · {formatDate(w.date)}
                  </Typography>
                </Box>
                {w.signed ? (
                  <Chip size="small" color="success" label={t("reports.recentWorkOrders.signed")} />
                ) : null}
                <ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
              </Box>
              {i < workOrders.length - 1 ? <Divider /> : null}
            </Box>
          ))
        )}
      </Box>
    </Card>
  );
}
