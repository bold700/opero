import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import { Card } from "../../../components/Card";
import { SPACING } from "../../../theme/tokens";
import type { WorkOrder } from "../api";

function localIsoDay(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function DailyMaterialsPanel({
  workOrder,
  canWrite,
  canCorrect,
  busy,
  onStart,
  onComplete,
  onCorrect,
}: {
  workOrder: WorkOrder;
  canWrite: boolean;
  canCorrect: boolean;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCorrect: () => void;
}) {
  const { t } = useTranslation();
  const today = localIsoDay();
  const todayLog = workOrder.workDays.find((day) => day.day === today);
  const activeLog = workOrder.workDays.find((day) => day.status === "started");
  const currentLog = activeLog ?? todayLog;
  const production = workOrder.materialPlan.filter((item) => item.kind === "production");
  const measurableProduction = production.filter((item) => item.plannedQuantity > 0);
  // Normalize each line before averaging: metres, pieces and m2 must never be
  // added together as if they were one unit.
  const progress = measurableProduction.length > 0
    ? measurableProduction.reduce(
        (sum, item) => sum + Math.min(100, (item.progressTotal / item.plannedQuantity) * 100),
        0,
      ) / measurableProduction.length
    : 0;
  const shortages = workOrder.materialPlan.filter(
    (item) => item.suggestedBrought > 0 && item.remainingQuantity > 0,
  );
  const latestCompleted = [...workOrder.workDays]
    .filter((day) => day.status === "completed")
    .sort((left, right) => right.day.localeCompare(left.day))[0];

  return (
    <Card>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SPACING.itemGap }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: SPACING.itemGap, minWidth: 0 }}>
          <Inventory2OutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{t("workOrderDetail.workDay.title")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("workOrderDetail.workDay.subtitle")}
            </Typography>
          </Box>
        </Box>
        {currentLog ? (
          <Chip
            size="small"
            color={currentLog.status === "completed" ? "success" : "primary"}
            label={t(`workOrderDetail.workDay.status.${currentLog.status}`)}
          />
        ) : null}
      </Box>

      {production.length > 0 ? (
        <Box sx={{ mt: SPACING.sectionGap }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: SPACING.itemGap, mb: SPACING.itemGap }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t("workOrderDetail.workDay.workProgress")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("workOrderDetail.workDay.progressPercent", { value: Math.round(progress) })}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      ) : null}

      <Divider sx={{ my: SPACING.sectionGap }} />

      {shortages.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.itemGap }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t("workOrderDetail.workDay.adviceTitle")}
          </Typography>
          {shortages.slice(0, 4).map((item) => (
            <Box key={`${item.taskMaterialId ?? item.requirementId ?? item.name}`} sx={{ display: "flex", justifyContent: "space-between", gap: SPACING.itemGap }}>
              <Typography variant="body2">{item.name}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: SPACING.itemGap }}>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {t("workOrderDetail.workDay.quantity", { quantity: item.suggestedBrought, unit: item.unit })}
                </Typography>
                {item.ready ? <Chip size="small" color="success" label={t("workOrderDetail.workDay.ready")} /> : null}
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("workOrderDetail.workDay.noShortage")}
        </Typography>
      )}

      <Box sx={{ mt: SPACING.sectionGap, display: "flex", flexWrap: "wrap", gap: SPACING.itemGap }}>
        {!activeLog && !todayLog ? (
          <Button
            variant="contained"
            startIcon={<PlayArrowOutlinedIcon />}
            disabled={!canWrite || busy || workOrder.materialPlan.length === 0}
            onClick={onStart}
          >
            {t("workOrderDetail.workDay.start")}
          </Button>
        ) : null}
        {activeLog ? (
          <Button
            variant="contained"
            startIcon={<TaskAltOutlinedIcon />}
            disabled={!canWrite || busy}
            onClick={onComplete}
          >
            {t("workOrderDetail.workDay.complete")}
          </Button>
        ) : null}
        {!activeLog && todayLog?.status === "completed" ? (
          <Button variant="outlined" disabled={!canCorrect || busy} onClick={onCorrect}>
            {t("workOrderDetail.workDay.correct")}
          </Button>
        ) : null}
      </Box>

      {latestCompleted ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: SPACING.itemGap }}>
          {t("workOrderDetail.workDay.lastCompleted", { day: latestCompleted.day, name: latestCompleted.completedByName ?? "" })}
        </Typography>
      ) : null}
    </Card>
  );
}
