import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../../components/StatusBadge";
import { SPACING, STATUS_TONES } from "../../../theme/tokens";
import { STATUS, WORK_ORDER_PHASE_TONES } from "../../work-orders/constants";
import { URGENCY } from "../constants";
import type { Project, WorkOrder } from "../api";
import { workOrderPlanningDates } from "../../../lib/planningDates";

function formatAddress(project: Project): string {
  const cityLine = [project.postalCode, project.city].filter(Boolean).join(" ");
  return [project.address, cityLine].filter(Boolean).join(", ");
}

export function WorkOrderHeaderSummary({
  workOrder,
  project,
  finished,
}: {
  workOrder: WorkOrder;
  project: Project;
  finished: boolean;
}) {
  const { t, i18n } = useTranslation();
  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const title =
    workOrder.title ||
    t("workOrderDetail.header.defaultTitle", { n: workOrder.ordinal + 1 });
  const address = formatAddress(project);
  const plannedDates = workOrderPlanningDates(workOrder);
  const planning = plannedDates.length
    ? plannedDates.map(formatDate).join(" · ")
    : t("workOrderDetail.header.notPlanned");
  const phaseStatus = `${t(`workOrderDetail.phase.${workOrder.phase}`)} – ${t(
    STATUS[workOrder.status].labelKey,
  )}`;
  const urgency = URGENCY[workOrder.urgency] ?? URGENCY.normal;

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {project.projectNumber}
        </Typography>
        <StatusBadge label={phaseStatus} tone={WORK_ORDER_PHASE_TONES[workOrder.phase]} />
        {project.blocked ? (
          <StatusBadge
            label={t("workOrderDetail.urgency.blocked")}
            tone={STATUS_TONES.danger}
          />
        ) : null}
        {finished ? (
          <StatusBadge
            label={t("workOrderDetail.header.signed")}
            tone={STATUS_TONES.success}
          />
        ) : null}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          gap: 1,
          flexWrap: "wrap",
          mt: SPACING.fieldLabelGap,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {project.customerName}
        </Typography>
        {address ? (
          <>
            <Typography variant="body2" color="text.disabled">·</Typography>
            <Typography variant="body2" color="text.secondary">
              {address}
            </Typography>
          </>
        ) : null}
        <Typography variant="body2" color="text.disabled">·</Typography>
        <Typography variant="body2" color="text.secondary">
          {planning}
        </Typography>
        <Typography variant="body2" color="text.disabled">·</Typography>
        <Typography variant="body2" color="text.secondary">
          {t(`workOrderDetail.urgency.${urgency.key}`)}
        </Typography>
        {finished && workOrder.signedByName ? (
          <Typography variant="body2" color="text.secondary">
            · {t("workOrderDetail.header.signedBy", { name: workOrder.signedByName })}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
