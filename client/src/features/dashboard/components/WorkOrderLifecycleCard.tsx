import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Link as RouterLink } from "react-router-dom";
import {
  workOrderPhaseForStatus,
  workOrderPhaseIds,
  workOrderStatusIds,
  type WorkOrderStatus,
} from "@opero/shared";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { SPACING, STATUS_DOT_SIZE } from "../../../theme/tokens";
import { WORK_ORDER_PHASE_TONES } from "../../work-orders/constants";

const statusTranslationKeys: Record<WorkOrderStatus, string> = {
  open: "workOrders.status.open",
  planned: "workOrders.status.planned",
  released: "workOrders.status.released",
  in_progress: "workOrders.status.inProgress",
  ready_for_review: "workOrders.status.readyForReview",
  approved: "workOrders.status.approved",
  ready_to_invoice: "workOrders.status.readyToInvoice",
  invoiced: "workOrders.status.invoiced",
  completed: "workOrders.status.completed",
};

export function WorkOrderLifecycleCard({
  counts,
}: {
  counts: Record<WorkOrderStatus, number>;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: SPACING.sectionGap }}>
        {t("dashboard.admin.workOrdersByPhase")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          gap: SPACING.sectionGap,
        }}
      >
        {workOrderPhaseIds.map((phase) => {
          const statuses = workOrderStatusIds.filter(
            (status) => workOrderPhaseForStatus(status) === phase,
          );
          const tone = WORK_ORDER_PHASE_TONES[phase];

          return (
            <Box key={phase} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: SPACING.itemGap,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t(`workOrderDetail.phase.${phase}`)}
                </Typography>
                <Box
                  aria-hidden
                  sx={{
                    width: STATUS_DOT_SIZE,
                    height: STATUS_DOT_SIZE,
                    borderRadius: "50%",
                    bgcolor: tone.fg,
                    flexShrink: 0,
                  }}
                />
              </Box>
              <Divider />
              {statuses.map((status, index) => {
                const label = t(statusTranslationKeys[status]);
                const count = counts[status] ?? 0;

                return (
                  <Box key={status}>
                    <Box
                      component={RouterLink}
                      to={`/work-orders?status=${status}`}
                      aria-label={t("dashboard.admin.viewWorkOrdersWithStatus", {
                        status: label,
                      })}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: SPACING.itemGap,
                        py: SPACING.itemGap,
                        color: "text.primary",
                        textDecoration: "none",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      <Typography color="inherit">{label}</Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: SPACING.fieldLabelGap,
                        }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>{count}</Typography>
                        <ChevronRightIcon fontSize="small" />
                      </Box>
                    </Box>
                    {index < statuses.length - 1 ? <Divider /> : null}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}
