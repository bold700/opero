import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import TextField from "@mui/material/TextField";
import { DateField } from "../../../components/DateField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type {
  SchedulableWorkOrder,
  AssignableEmployee,
  ScheduleInput,
} from "../api";
import { getAssignableEmployees } from "../api";
import { useIsMobile } from "../../../lib/useIsMobile";

// 24-hour time slots in 15-minute steps (00:00 … 23:45) — European clock, no
// AM/PM, no arbitrary minutes.
const TIME_SLOTS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// Schedule a werkbon on the calendar (or reschedule an existing one). When
// `lockedWorkOrder` is set we're editing that entry (werkbon not changeable);
// otherwise the user picks a werkbon from the dropdown.
export function ScheduleDialog({
  open,
  workOrders,
  employees,
  lockedWorkOrder,
  defaultDate,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  workOrders: SchedulableWorkOrder[];
  employees: AssignableEmployee[];
  lockedWorkOrder?: { id: string; label: string } | null;
  defaultDate?: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (workOrderId: string, input: ScheduleInput) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [workOrderId, setWorkOrderId] = useState("");
  const [date, setDate] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (!open) return;
    setWorkOrderId(lockedWorkOrder?.id ?? "");
    setDate(defaultDate ?? "");
    setTeamLeaderId("");
    setStartTime("");
    setEndTime("");
  }, [open, lockedWorkOrder, defaultDate]);

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

  // Availability for the chosen day. Refetched when the date changes, because
  // "who is available" is a property of the DAY, not of the dialog opening —
  // the `employees` prop is the undated list.
  const [availability, setAvailability] = useState<AssignableEmployee[] | null>(null);
  useEffect(() => {
    if (!open || !date) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    getAssignableEmployees({ date })
      .then((rows) => {
        if (!cancelled) setAvailability(rows);
      })
      // Availability is an enhancement: if the lookup fails, fall back to the
      // plain list rather than blocking scheduling entirely. The backend
      // refuses an absent leader regardless, so nothing slips through.
      .catch(() => {
        if (!cancelled) setAvailability(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, date]);

  // Merge the annotation onto the prop list, so the options stay stable while
  // availability is still loading.
  const unavailableById = new Map(
    (availability ?? []).filter((e) => e.unavailable).map((e) => [e.id, e.unavailable!]),
  );

  // Can't schedule in the past.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const dateInPast = Boolean(date) && date < today;

  // Picking someone who is away is refused by the backend, so block it here
  // too rather than letting the office submit into a guaranteed error.
  const leaderAbsence = teamLeaderId ? unavailableById.get(teamLeaderId) : undefined;

  const canSubmit =
    Boolean(workOrderId && date) && !dateInPast && !leaderAbsence && !busy;

  const submit = () =>
    onSubmit(workOrderId, {
      date,
      teamLeaderId: teamLeaderId || null,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    });

  return (
    <ResponsiveDialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" title={lockedWorkOrder ? t("planning.schedule.editTitle") : t("planning.schedule.newTitle")}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {lockedWorkOrder ? t("planning.schedule.editTitle") : t("planning.schedule.newTitle")}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {lockedWorkOrder ? (
            <TextField
              label={t("planning.schedule.workOrder")}
              value={lockedWorkOrder.label}
              disabled
              size="small"
            />
          ) : (
            <SelectField
              label={t("planning.schedule.workOrder")}
              value={workOrderId}
              onChange={setWorkOrderId}
              disabled={busy}
              autoFocus={!isMobile}
              options={workOrders.map((w) => ({
                value: w.id,
                label: `${w.number} · ${w.customerName}`,
              }))}
            />
          )}

          {/* Local state, committed on submit — safe to keep `disabled={busy}`
              here (busy only flips when the dialog itself saves). */}
          <DateField
            label={t("planning.schedule.date")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={busy}
            size="small"
            error={dateInPast}
            helperText={dateInPast ? t("planning.schedule.dateInPast") : undefined}
            slotProps={{
              htmlInput: { min: today },
            }}
          />

          {/* Absent staff stay in the list, labelled with why — removing them
              would read as "no longer employed". Picking one blocks submit. */}
          <SelectField
            label={t("planning.schedule.teamLeader")}
            value={teamLeaderId}
            onChange={setTeamLeaderId}
            disabled={busy}
            error={Boolean(leaderAbsence)}
            helperText={
              leaderAbsence
                ? t("planning.schedule.leaderUnavailable", {
                    from: leaderAbsence.startDate,
                    to: leaderAbsence.endDate,
                  })
                : undefined
            }
            options={[
              { value: "", label: t("planning.schedule.unassigned") },
              ...employees.map((e) => {
                const away = unavailableById.get(e.id);
                return {
                  value: e.id,
                  label: away
                    ? `${e.name} — ${t("planning.schedule.away")}`
                    : e.name,
                };
              }),
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
