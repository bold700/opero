import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  workOrderPhaseIds,
  type WorkOrderPhase,
  type WorkOrderStatus,
} from "@opero/shared";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import {
  RADIUS,
  SPACING,
  WORK_ORDER_TIMELINE,
} from "../../../theme/tokens";
import { STATUS, WORK_ORDER_PHASE_TONES } from "../../work-orders/constants";

export function WorkOrderLifecycleTimeline({
  phase,
  status,
}: {
  phase: WorkOrderPhase;
  status: WorkOrderStatus;
}) {
  const { t } = useTranslation();
  const activeIndex = workOrderPhaseIds.indexOf(phase);

  return (
    <Card>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t("workOrderDetail.lifecycle.title")}
      </Typography>

      <Box sx={{ mt: SPACING.itemGap }}>
        {workOrderPhaseIds.map((phaseId, index) => {
          const isComplete = index < activeIndex;
          const isCurrent = phaseId === phase;
          const tone = WORK_ORDER_PHASE_TONES[phaseId];
          const markerColor = isComplete || isCurrent ? tone.fg : "text.disabled";

          return (
            <Box
              key={phaseId}
              sx={{
                display: "flex",
                alignItems: "stretch",
                gap: SPACING.itemGap,
              }}
            >
              <Box
                sx={{
                  width: WORK_ORDER_TIMELINE.markerSize,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Box
                  sx={{
                    width: WORK_ORDER_TIMELINE.markerSize,
                    height: WORK_ORDER_TIMELINE.markerSize,
                    borderRadius: `${RADIUS.pill}px`,
                    display: "grid",
                    placeItems: "center",
                    color: isComplete ? "common.white" : markerColor,
                    bgcolor: isComplete ? tone.fg : isCurrent ? tone.bg : "transparent",
                    border: "1px solid",
                    borderColor: markerColor,
                  }}
                >
                  {isComplete ? (
                    <CheckRoundedIcon fontSize="small" />
                  ) : (
                    <Box
                      sx={{
                        width: WORK_ORDER_TIMELINE.markerDotSize,
                        height: WORK_ORDER_TIMELINE.markerDotSize,
                        borderRadius: `${RADIUS.pill}px`,
                        bgcolor: isCurrent ? tone.fg : "transparent",
                      }}
                    />
                  )}
                </Box>

                {index < workOrderPhaseIds.length - 1 ? (
                  <Box
                    sx={{
                      flex: 1,
                      width: WORK_ORDER_TIMELINE.connectorWidth,
                      bgcolor: index < activeIndex ? tone.fg : "divider",
                    }}
                  />
                ) : null}
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  mb: index < workOrderPhaseIds.length - 1 ? SPACING.itemGap : 0,
                  p: SPACING.itemGap,
                  borderRadius: `${RADIUS.control}px`,
                  bgcolor: isCurrent ? tone.bg : "transparent",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: isCurrent ? 700 : 600,
                    color: isCurrent ? tone.fg : "text.primary",
                  }}
                >
                  {t(`workOrderDetail.phase.${phaseId}`)}
                </Typography>

                {isCurrent ? (
                  <Box sx={{ mt: SPACING.fieldLabelGap }}>
                    <StatusBadge
                      label={t(STATUS[status].labelKey)}
                      tone={STATUS[status].tone}
                    />
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      isComplete
                        ? "workOrderDetail.lifecycle.completed"
                        : "workOrderDetail.lifecycle.upcoming",
                    )}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}
