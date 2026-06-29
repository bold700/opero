import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import { TopBar } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { useCreateParam } from "../../lib/useCreateParam";
import { SURFACE, SPACING } from "../../theme/tokens";
import {
  getPlanning,
  scheduleProject,
  unscheduleProject,
  getProjectsForScheduling,
  getAssignableEmployees,
  type PlanningEntry,
  type ScheduleInput,
  type SchedulableProject,
  type AssignableEmployee,
} from "./api";
import { PlanningActions } from "./components/PlanningActions";
import { DetailsPanel } from "./components/DetailsPanel";
import { CalendarView, type CalendarViewName } from "./components/CalendarView";
import { ScheduleDialog } from "./components/ScheduleDialog";

export function Planning() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === "admin";

  const [view, setView] = useState<CalendarViewName>("timeGridWeek");
  const [dateWindow, setDateWindow] = useState<{ from: string; to: string } | null>(null);
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dropdown sources for the schedule dialog.
  const [projects, setProjects] = useState<SchedulableProject[]>([]);
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);

  // Dialog state.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<PlanningEntry | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [removing, setRemoving] = useState<PlanningEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch the feed for the visible window (called by FullCalendar's datesSet).
  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getPlanning(from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon planning niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dateWindow) load(dateWindow.from, dateWindow.to);
  }, [dateWindow, load]);

  // Load dropdown data once (admins only — they're the schedulers).
  useEffect(() => {
    if (!canManage) return;
    getProjectsForScheduling().then(setProjects).catch(() => setProjects([]));
    getAssignableEmployees().then(setEmployees).catch(() => setEmployees([]));
  }, [canManage]);

  const refresh = () => {
    if (dateWindow) load(dateWindow.from, dateWindow.to);
  };

  const selected =
    entries.find((e) => `${e.projectId}-${e.date}` === selectedId) ?? null;

  const fcLocale = i18n.language.startsWith("nl") ? "nl" : "en";

  const openCreate = (date?: string) => {
    setEditing(null);
    setDefaultDate(date);
    setFormError(null);
    setScheduleOpen(true);
  };
  // Open the schedule dialog when arriving via the quick-create menu (?create=1).
  useCreateParam(() => openCreate(), canManage);
  const openEdit = (entry: PlanningEntry) => {
    setEditing(entry);
    setDefaultDate(entry.date);
    setFormError(null);
    setScheduleOpen(true);
  };

  const handleSchedule = async (projectId: string, input: ScheduleInput) => {
    setBusy(true);
    setFormError(null);
    try {
      await scheduleProject(projectId, input);
      setScheduleOpen(false);
      setToast(t("planning.toast.scheduled"));
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("planning.toast.scheduleError"));
    } finally {
      setBusy(false);
    }
  };

  // Drag-to-reschedule: same project, new date/time. Reject drops into the past.
  const handleDrop = async (
    entry: PlanningEntry,
    date: string,
    startTime?: string,
    endTime?: string,
  ) => {
    const today = new Date().toLocaleDateString("en-CA");
    if (date < today) {
      setToast(t("planning.schedule.dateInPast"));
      refresh(); // snap the event back
      return;
    }
    setBusy(true);
    try {
      await scheduleProject(entry.projectId, { date, startTime, endTime });
      setToast(t("planning.toast.scheduled"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("planning.toast.scheduleError"));
      refresh(); // revert the optimistic drag by reloading
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await unscheduleProject(removing.projectId);
      setRemoving(null);
      setSelectedId(null);
      setToast(t("planning.toast.removed"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("planning.toast.removeError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ bgcolor: SURFACE, minHeight: "100dvh" }}>
      <TopBar
        title={t("planning.title")}
        actions={
          <PlanningActions
            view={view}
            onView={setView}
            onCreate={() => openCreate()}
            canCreate={canManage}
          />
        }
      />

      {error ? (
        <Box sx={{ p: SPACING.pagePadding }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "stretch", height: "calc(100dvh - 64px)" }}>
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, p: SPACING.pagePadding, position: "relative", display: "flex", flexDirection: "column" }}>
            {loading ? (
              <Box sx={{ position: "absolute", top: 12, right: 24, zIndex: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : null}
            <CalendarView
              events={entries}
              view={view}
              locale={fcLocale}
              editable={canManage}
              onDatesSet={(from, to) => setDateWindow({ from, to })}
              onEventClick={(entry) => setSelectedId(`${entry.projectId}-${entry.date}`)}
              onDateClick={(date) => canManage && openCreate(date)}
              onEventDrop={handleDrop}
            />
          </Box>

          {selected ? (
            <DetailsPanel
              entry={selected}
              canManage={canManage}
              busy={busy}
              onOpenWorkOrder={() => navigate(`/work-orders?project=${selected.projectId}`)}
              onEdit={() => openEdit(selected)}
              onRemove={() => setRemoving(selected)}
            />
          ) : (
            <Box sx={{ width: 320, flexShrink: 0, p: SPACING.pagePadding, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider" }}>
              <Typography color="text.secondary">{t("planning.emptyWeek")}</Typography>
            </Box>
          )}
        </Box>
      )}

      <ScheduleDialog
        open={scheduleOpen}
        projects={projects}
        employees={employees}
        lockedProject={
          editing
            ? { id: editing.projectId, label: `${editing.projectNumber} · ${editing.customerName}` }
            : null
        }
        defaultDate={defaultDate}
        busy={busy}
        error={formError}
        onClose={() => setScheduleOpen(false)}
        onSubmit={handleSchedule}
      />

      <ConfirmDialog
        open={removing !== null}
        title={t("planning.remove.title")}
        body={removing ? t("planning.remove.body", { name: removing.customerName }) : undefined}
        busy={busy}
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={handleRemove}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </Box>
  );
}
