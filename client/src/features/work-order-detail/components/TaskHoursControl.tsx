import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import type { WorkOrderTask } from "../api";

// The zone's hours, compact, next to the status badge: timer start/stop or a
// typed total, plus who logged. Registration, so technicians may use it.
export function TaskHoursControl({
  task,
  canWrite,
  busy,
  onStart,
  onEnd,
  onSetHours,
}: {
  task: WorkOrderTask;
  canWrite: boolean;
  busy: boolean;
  onStart: () => void;
  onEnd: () => void;
  onSetHours: (hours: number) => void;
}) {
  const { t } = useTranslation();
  const running = !!task.startedAt && !task.endedAt;

  if (!canWrite) {
    return task.hours != null ? (
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {t("workOrderDetail.zone.hoursValue", { hours: task.hours })}
        {task.hoursEmployeeName ? (
          <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
            {` · ${task.hoursEmployeeName}`}
          </Box>
        ) : null}
      </Typography>
    ) : (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>—</Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {running ? (
        <Button size="small" variant="contained" color="error" startIcon={<StopIcon />} onClick={onEnd} disabled={busy}>
          {t("workOrderDetail.zone.stopTimer")}
        </Button>
      ) : (
        <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={onStart} disabled={busy || !!task.endedAt}>
          {t("workOrderDetail.zone.startTimer")}
        </Button>
      )}
      <TextField
        size="small"
        type="number"
        label={t("workOrderDetail.zone.hoursLabel")}
        defaultValue={task.hours ?? ""}
        key={`h-${task.id}-${task.hours ?? ""}`}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= 0 && v !== (task.hours ?? 0)) onSetHours(v);
        }}
        disabled={busy}
        slotProps={{ htmlInput: { min: 0, step: 0.25 } }}
        sx={{ width: 96 }}
      />
      {task.hoursEmployeeName ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {t("workOrderDetail.zone.loggedBy", { name: task.hoursEmployeeName })}
        </Typography>
      ) : null}
    </Box>
  );
}
