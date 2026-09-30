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

type TimelineRow =
  | { kind: "phase"; phase: WorkOrderPhase }
  | { kind: "status"; phase: WorkOrderPhase; status: WorkOrderStatus };

const TIMELINE_ROWS: readonly TimelineRow[] = workOrderPhaseIds.flatMap(
  (phaseId) => [
    { kind: "phase" as const, phase: phaseId },
    ...PHASE_STATUSES[phaseId].map((statusId) => ({
      kind: "status" as const,
      phase: phaseId,
      status: statusId,
    })),
  ],
);

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
  const activeRowIndex = TIMELINE_ROWS.findIndex(
    (row) => row.kind === "status" && row.status === status,
  );

  return (
    <Card>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {t("workOrderDetail.lifecycle.title")}
      </Typography>

      <Box sx={{ mt: SPACING.itemGap }}>
        {TIMELINE_ROWS.map((row, rowIndex) => {
          const phaseIndex = workOrderPhaseIds.indexOf(row.phase);
          const tone = WORK_ORDER_PHASE_TONES[row.phase];
          const isFirst = rowIndex === 0;
          const isLast = rowIndex === TIMELINE_ROWS.length - 1;
          const isPhase = row.kind === "phase";
          const isCurrentPhase = isPhase && row.phase === phase;
          const isCompletedPhase = isPhase && phaseIndex < activePhaseIndex;
          const statusIndex = row.kind === "status"
            ? workOrderStatusIds.indexOf(row.status)
            : -1;
          const isCurrentStatus = row.kind === "status" && row.status === status;
          const isCompletedStatus = row.kind === "status" && statusIndex < activeStatusIndex;
          const isReached = rowIndex <= activeRowIndex;
          const continuesReachedPath = rowIndex < activeRowIndex;
          const markerSize = isPhase
            ? WORK_ORDER_TIMELINE.markerSize
            : WORK_ORDER_TIMELINE.statusMarkerSize;

          return (
            <Box
              key={row.kind === "phase" ? row.phase : row.status}
              sx={{
                display: "flex",
                alignItems: "stretch",
                minHeight: isPhase
                  ? WORK_ORDER_TIMELINE.phaseRowMinHeight
                  : WORK_ORDER_TIMELINE.statusRowMinHeight,
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: WORK_ORDER_TIMELINE.markerSize,
                  flexShrink: 0,
                }}
              >
                {!isFirst ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      bottom: "50%",
                      left: WORK_ORDER_TIMELINE.trackOffset,
                      width: WORK_ORDER_TIMELINE.connectorWidth,
                      bgcolor: isReached ? tone.fg : "divider",
                    }}
                  />
                ) : null}
                {!isLast ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      bottom: 0,
                      left: WORK_ORDER_TIMELINE.trackOffset,
                      width: WORK_ORDER_TIMELINE.connectorWidth,
                      bgcolor: continuesReachedPath ? tone.fg : "divider",
                    }}
                  />
                ) : null}

                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    zIndex: 1,
                    width: markerSize,
                    height: markerSize,
                    borderRadius: `${RADIUS.pill}px`,
                    display: "grid",
                    placeItems: "center",
                    fontSize: isPhase
                      ? WORK_ORDER_TIMELINE.statusMarkerSize
                      : WORK_ORDER_TIMELINE.statusIconSize,
                    color:
                      isCompletedPhase || isCompletedStatus
                        ? "common.white"
                        : tone.fg,
                    bgcolor:
                      isCompletedPhase || isCompletedStatus
                        ? tone.fg
                        : isCurrentPhase
                          ? tone.bg
                          : "background.paper",
                    border: "1px solid",
                    borderColor:
                      isReached || isCurrentPhase || isCurrentStatus
                        ? tone.fg
                        : "divider",
                  }}
                >
                  {isCompletedPhase || isCompletedStatus ? (
                    <CheckRoundedIcon fontSize="inherit" />
                  ) : isCurrentPhase || isCurrentStatus ? (
                    <Box
                      sx={{
                        width: isPhase
                          ? WORK_ORDER_TIMELINE.markerDotSize
                          : WORK_ORDER_TIMELINE.statusDotSize,
                        height: isPhase
                          ? WORK_ORDER_TIMELINE.markerDotSize
                          : WORK_ORDER_TIMELINE.statusDotSize,
                        borderRadius: `${RADIUS.pill}px`,
                        bgcolor: tone.fg,
                      }}
                    />
                  ) : null}
                </Box>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  alignSelf: "center",
                  ml: SPACING.itemGap,
                  px: isCurrentStatus ? SPACING.itemGap : 0,
                  py: isCurrentStatus ? SPACING.fieldLabelGap : 0,
                  borderRadius: `${RADIUS.control}px`,
                  bgcolor: isCurrentStatus ? tone.bg : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.itemGap,
                }}
              >
                <Typography
                  variant={isPhase ? "subtitle2" : "body2"}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: isPhase || isCurrentStatus ? 700 : 400,
                    color:
                      isCurrentPhase || isCurrentStatus
                        ? tone.fg
                        : isPhase || isCompletedStatus
                          ? "text.primary"
                          : "text.secondary",
                  }}
                >
                  {row.kind === "phase"
                    ? t(`workOrderDetail.phase.${row.phase}`)
                    : t(STATUS[row.status].labelKey)}
                </Typography>

                {isCurrentStatus ? (
                  <Typography
                    variant="caption"
                    sx={{ color: tone.fg, fontWeight: 700 }}
                  >
                    {t("workOrderDetail.lifecycle.current")}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}
