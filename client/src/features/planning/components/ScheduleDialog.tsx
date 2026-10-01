import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDirty } from "../../../lib/isDirty";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField } from "../../../components/SelectField";
import TextField from "@mui/material/TextField";
import { PlanningDatesField } from "../../../components/PlanningDatesField";
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

import { suggestEndTime } from "../../../lib/timeSlots";

// Schedule a werkbon on the calendar (or reschedule an existing one). When
// `lockedWorkOrder` is set we're editing that entry (werkbon not changeable);
// otherwise the user picks a werkbon from the dropdown.
export function ScheduleDialog({
  open,
  workOrders,
  employees,
  lockedWorkOrder,
  defaultDate,
  defaultDates,
  defaultStartTime,
  defaultEndTime,
  defaultTeamLeaderId,
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
  defaultDates?: string[];
  /** Rescheduling: seed the form with the slot's current times + crew, so an
   *  edit starts from what is planned instead of an empty form. */
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultTeamLeaderId?: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (workOrderId: string, input: ScheduleInput) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [workOrderId, setWorkOrderId] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [teamLeaderId, setTeamLeaderId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const defaultDatesKey = (defaultDates ?? []).join(",");

  // What the form was seeded with, so an untouched reschedule can't be saved.
  // Null while creating: there is no "before" to compare a new slot against.
  const initialValues = useRef<{
    dates: string[];
    teamLeaderId: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setWorkOrderId(lockedWorkOrder?.id ?? "");
    const seededDates = defaultDatesKey
      ? defaultDatesKey.split(",")
      : defaultDate
        ? [defaultDate]
        : [];
    setDates(seededDates);
    setTeamLeaderId(defaultTeamLeaderId ?? "");
    setStartTime(defaultStartTime ?? "");
    setEndTime(defaultEndTime ?? "");
    initialValues.current = lockedWorkOrder
      ? {
          dates: seededDates,
          teamLeaderId: defaultTeamLeaderId ?? "",
          startTime: defaultStartTime ?? "",
          endTime: defaultEndTime ?? "",
        }
      : null;
  }, [
    open,
    lockedWorkOrder,
    defaultDate,
    defaultDatesKey,
    defaultStartTime,
    defaultEndTime,
    defaultTeamLeaderId,
  ]);

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
      const suggested = suggestEndTime(value);
      if (suggested > value) setEndTime(suggested);
    }
  };

  // Availability for all chosen workdays. A technician is marked unavailable
  // if any selected day overlaps an absence.
  // "who is available" is a property of the DAY, not of the dialog opening —
  // the `employees` prop is the undated list.
  const [availability, setAvailability] = useState<AssignableEmployee[] | null>(null);
  useEffect(() => {
    if (!open || dates.length === 0) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    Promise.all(dates.map((date) => getAssignableEmployees({ date })))
      .then((resultSets) => {
        if (cancelled) return;
        const merged = new Map<string, AssignableEmployee>();
        for (const rows of resultSets) {
          for (const row of rows) {
            const current = merged.get(row.id);
            merged.set(row.id, current?.unavailable ? current : row);
          }
        }
        setAvailability([...merged.values()]);
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
  }, [open, dates]);

  // Merge the annotation onto the prop list, so the options stay stable while
  // availability is still loading.
  const unavailableById = new Map(
    (availability ?? []).filter((e) => e.unavailable).map((e) => [e.id, e.unavailable!]),
  );

  // Can't schedule in the past.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const dateInPast = dates.some((date) => date < today);

  // Picking someone who is away is refused by the backend, so block it here
  // too rather than letting the office submit into a guaranteed error.
  const leaderAbsence = teamLeaderId ? unavailableById.get(teamLeaderId) : undefined;
  const timeRangeInvalid = Boolean(startTime && endTime && endTime <= startTime);

  // Rescheduling needs an actual change; creating only needs the required
  // fields (there is nothing to diff a brand-new slot against).
  const dirty = useDirty(
    { dates, teamLeaderId, startTime, endTime },
    initialValues.current,
  );
  const canSubmit =
    Boolean(workOrderId && dates.length) &&
    !dateInPast &&
    !leaderAbsence &&
    !timeRangeInvalid &&
    !busy &&
    (!lockedWorkOrder || dirty);

  const submit = () =>
    onSubmit(workOrderId, {
      dates,
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
          <PlanningDatesField
            value={dates}
            onChange={setDates}
            disabled={busy}
            minimumDate={today}
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
            <TextField
              type="time"
              label={t("planning.schedule.startTime")}
              value={startTime}
              onChange={(event) => onStartChange(event.target.value)}
              disabled={busy}
              size="small"
              sx={{ flex: 1 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="time"
              label={t("planning.schedule.endTime")}
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={busy || !startTime}
              size="small"
              sx={{ flex: 1 }}
              error={timeRangeInvalid}
              helperText={
                !startTime
                  ? t("planning.schedule.pickStartFirst")
                  : timeRangeInvalid
                    ? t("planning.schedule.endAfterStart")
                    : undefined
              }
              slotProps={{ inputLabel: { shrink: true } }}
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
