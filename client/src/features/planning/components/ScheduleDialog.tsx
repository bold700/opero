import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type {
  SchedulableProject,
  AssignableEmployee,
  ScheduleInput,
} from "../api";

// 24-hour time slots in 15-minute steps (00:00 … 23:45) — European clock, no
// AM/PM, no arbitrary minutes.
const TIME_SLOTS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// Schedule a project on the calendar (or reschedule an existing one). When
// `lockedProject` is set we're editing that entry (project not changeable);
// otherwise the user picks a project from the dropdown.
export function ScheduleDialog({
  open,
  projects,
  employees,
  lockedProject,
  defaultDate,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  projects: SchedulableProject[];
  employees: AssignableEmployee[];
  lockedProject?: { id: string; label: string } | null;
  defaultDate?: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (projectId: string, input: ScheduleInput) => void;
}) {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (!open) return;
    setProjectId(lockedProject?.id ?? "");
    setDate(defaultDate ?? "");
    setTeamLeaderId("");
    setStartTime("");
    setEndTime("");
  }, [open, lockedProject, defaultDate]);

  // Smart start: clears an end that's no longer after start; if no end is set,
  // suggests start + 2h (a typical job slot, capped at 23:45).
  const onStartChange = (value: string) => {
    setStartTime(value);
    if (!value) return;
    if (endTime && endTime <= value) {
      setEndTime("");
      return;
    }
    if (!endTime) {
      const idx = TIME_SLOTS.indexOf(value);
      const suggested = TIME_SLOTS[Math.min(idx + 8, TIME_SLOTS.length - 1)];
      if (suggested > value) setEndTime(suggested);
    }
  };

  // End-time choices: only slots strictly after the chosen start.
  const endOptions = startTime
    ? TIME_SLOTS.filter((s) => s > startTime)
    : TIME_SLOTS;

  // Can't schedule in the past.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const dateInPast = Boolean(date) && date < today;

  const canSubmit = Boolean(projectId && date) && !dateInPast && !busy;

  const submit = () =>
    onSubmit(projectId, {
      date,
      teamLeaderId: teamLeaderId || null,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    });

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" title={lockedProject ? t("planning.schedule.editTitle") : t("planning.schedule.newTitle")}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {lockedProject ? t("planning.schedule.editTitle") : t("planning.schedule.newTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {lockedProject ? (
            <TextField
              label={t("planning.schedule.project")}
              value={lockedProject.label}
              disabled
              size="small"
            />
          ) : (
            <SelectField
              label={t("planning.schedule.project")}
              value={projectId}
              onChange={setProjectId}
              disabled={busy}
              autoFocus
              options={projects.map((p) => ({
                value: p.id,
                label: `${p.projectNumber} · ${p.customerName}`,
              }))}
            />
          )}

          <TextField
            label={t("planning.schedule.date")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
            size="small"
            error={dateInPast}
            helperText={dateInPast ? t("planning.schedule.dateInPast") : undefined}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: today },
            }}
          />

          <SelectField
            label={t("planning.schedule.teamLeader")}
            value={teamLeaderId}
            onChange={setTeamLeaderId}
            disabled={busy}
            options={[
              { value: "", label: t("planning.schedule.unassigned") },
              ...employees.map((e) => ({ value: e.id, label: e.name })),
            ]}
          />

          <Box sx={{ display: "flex", gap: 2 }}>
            <SelectField
              label={t("planning.schedule.startTime")}
              value={startTime}
              onChange={onStartChange}
              disabled={busy}
              sx={{ flex: 1 }}
              options={[
                { value: "", label: t("planning.schedule.noTime") },
                ...TIME_SLOTS.map((s) => ({ value: s, label: s })),
              ]}
            />
            <SelectField
              label={t("planning.schedule.endTime")}
              value={endTime}
              onChange={setEndTime}
              disabled={busy || !startTime}
              sx={{ flex: 1 }}
              helperText={!startTime ? t("planning.schedule.pickStartFirst") : undefined}
              options={[
                { value: "", label: t("planning.schedule.noTime") },
                ...endOptions.map((s) => ({ value: s, label: s })),
              ]}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t("common.actions.save")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
