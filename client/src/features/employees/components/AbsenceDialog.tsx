import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { DateField } from "../../../components/DateField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { ResponsiveDialog } from "../../../components/ResponsiveDialog";
import { SelectField, type SelectOption } from "../../../components/SelectField";
import {
  createAbsence,
  deleteAbsence,
  getAbsences,
  type Absence,
  type AbsenceKind,
  type EmployeeRow,
} from "../api";

const KINDS: AbsenceKind[] = ["vacation", "sick", "training", "other"];

// Manage one employee's absence periods: holiday, sick leave, training.
//
// The pre-existing "on_leave" status is a permanent flag with no dates, so it
// can't say "away 3–17 August" and never stops being true. These are dated
// periods, and planning reads them: an absent monteur is greyed out in the
// assignee picker and cannot be scheduled as team leader for those days.
export function AbsenceDialog({
  employee,
  onClose,
}: {
  // null → closed. Non-null → the employee whose absences we're editing.
  employee: EmployeeRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Absence[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<AbsenceKind>("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  const load = async (employeeId: string) => {
    setError(null);
    try {
      // From the beginning of time, so past absences stay visible/removable —
      // the API's default window starts today.
      setRows(await getAbsences({ employeeId, from: "0001-01-01" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("employees.absence.loadError"));
    }
  };

  useEffect(() => {
    if (!employee) return;
    setRows(null);
    setKind("vacation");
    setStartDate("");
    setEndDate("");
    setNote("");
    void load(employee.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  if (!employee) return null;

  // Both ends required; a single day off is start === end. String compare is a
  // correct day compare for YYYY-MM-DD.
  const rangeValid = Boolean(startDate && endDate) && startDate <= endDate;
  const canSubmit = rangeValid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await createAbsence({
        employeeId: employee.id,
        kind,
        startDate,
        endDate,
        note: note.trim() || undefined,
      });
      setStartDate("");
      setEndDate("");
      setNote("");
      await load(employee.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("employees.absence.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteAbsence(id);
      await load(employee.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("employees.absence.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  const kindOptions: SelectOption[] = KINDS.map((k) => ({
    value: k,
    label: t(`employees.absence.kind.${k}`),
  }));

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={t("employees.absence.title", { name: employee.name })}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {t("employees.absence.title", { name: employee.name })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {t("employees.absence.subtitle")}
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {/* Existing periods */}
        {rows === null ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {t("employees.absence.empty")}
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {rows.map((a) => (
              <Box
                key={a.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: "none" },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t(`employees.absence.kind.${a.kind}`)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {a.startDate === a.endDate
                      ? a.startDate
                      : `${a.startDate} – ${a.endDate}`}
                    {a.note ? ` · ${a.note}` : ""}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={t("common.actions.delete")}
                  onClick={() => remove(a.id)}
                  disabled={busy}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* Add a new period */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <SelectField
            label={t("employees.absence.kindLabel")}
            value={kind}
            onChange={(v) => setKind(v as AbsenceKind)}
            options={kindOptions}
            fullWidth
          />
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <DateField
              size="small"
              label={t("employees.absence.from")}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                // A single day is the common case: mirror the end date so the
                // office only has to touch one field for it.
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
              sx={{ flex: 1, minWidth: 150 }}
            />
            <DateField
              size="small"
              label={t("employees.absence.to")}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={Boolean(startDate && endDate) && startDate > endDate}
              helperText={
                Boolean(startDate && endDate) && startDate > endDate
                  ? t("employees.absence.rangeError")
                  : undefined
              }
              sx={{ flex: 1, minWidth: 150 }}
            />
          </Box>
          <TextField
            label={t("employees.absence.note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.actions.close")}</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit}>
          {t("employees.absence.add")}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
