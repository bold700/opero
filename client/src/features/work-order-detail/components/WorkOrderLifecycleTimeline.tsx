import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  workOrderPhaseIds,
  workOrderStatusIds,
  type WorkOrderPhase,
  type WorkOrderStatus,
} from "@opero/shared";
import { Card } from "../../../components/Card";
import {
  RADIUS,
  SPACING,
  WORK_ORDER_TIMELINE,
} from "../../../theme/tokens";
import { STATUS, WORK_ORDER_PHASE_TONES } from "../../work-orders/constants";

const PHASE_STATUSES: Record<WorkOrderPhase, readonly WorkOrderStatus[]> = {
  preparation: ["open", "planned", "released"],
  realization: ["in_progress", "ready_for_review", "approved"],
  completion: ["ready_to_invoice", "invoiced", "completed"],
};

export function WorkOrderLifecycleTimeline({
  phase,
  status,
}: {
  phase: WorkOrderPhase;
  status: WorkOrderStatus;
}) {
  const { t } = useTranslation();
  const activePhaseIndex = workOrderPhaseIds.indexOf(phase);
  const activeStatusIndex = workOrderStatusIds.indexOf(status);

  return (
    <Card>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t("workOrderDetail.lifecycle.title")}
      </Typography>

      <Box sx={{ mt: SPACING.itemGap }}>
        {workOrderPhaseIds.map((phaseId, index) => {
          const isComplete = index < activePhaseIndex;
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
                      bgcolor: index < activePhaseIndex ? tone.fg : "divider",
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

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: SPACING.fieldLabelGap,
                    mt: SPACING.fieldLabelGap,
                  }}
                >
                  {PHASE_STATUSES[phaseId].map((statusId) => {
                    const statusIndex = workOrderStatusIds.indexOf(statusId);
                    const statusComplete = statusIndex < activeStatusIndex;
                    const statusCurrent = statusId === status;

                    return (
                      <Box
                        key={statusId}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: SPACING.itemGap,
                          minWidth: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: WORK_ORDER_TIMELINE.statusMarkerSize,
                            height: WORK_ORDER_TIMELINE.statusMarkerSize,
                            flexShrink: 0,
                            borderRadius: `${RADIUS.pill}px`,
                            display: "grid",
                            placeItems: "center",
                            fontSize: WORK_ORDER_TIMELINE.statusIconSize,
                            color: statusComplete ? "common.white" : tone.fg,
                            bgcolor: statusComplete ? tone.fg : "transparent",
                            border: "1px solid",
                            borderColor:
                              statusComplete || statusCurrent ? tone.fg : "divider",
                          }}
                        >
                          {statusComplete ? (
                            <CheckRoundedIcon fontSize="inherit" />
                          ) : statusCurrent ? (
                            <Box
                              sx={{
                                width: WORK_ORDER_TIMELINE.statusDotSize,
                                height: WORK_ORDER_TIMELINE.statusDotSize,
                                borderRadius: `${RADIUS.pill}px`,
                                bgcolor: tone.fg,
                              }}
                            />
                          ) : null}
                        </Box>

                        <Typography
                          variant="body2"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            fontWeight: statusCurrent ? 700 : 400,
                            color: statusCurrent
                              ? tone.fg
                              : statusComplete
                                ? "text.primary"
                                : "text.secondary",
                          }}
                        >
                          {t(STATUS[statusId].labelKey)}
                        </Typography>

                        {statusCurrent ? (
                          <Typography
                            variant="caption"
                            sx={{ color: tone.fg, fontWeight: 700 }}
                          >
                            {t("workOrderDetail.lifecycle.current")}
                          </Typography>
                        ) : null}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}
