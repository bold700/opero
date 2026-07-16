import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { TopBar } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { useCreateParam } from "../../lib/useCreateParam";
import { SURFACE, SPACING, PAGE_PADDING_RESPONSIVE } from "../../theme/tokens";
import {
  getPlanning,
  scheduleWorkOrder,
  unscheduleWorkOrder,
  getWorkOrdersForScheduling,
  getAssignableEmployees,
  type PlanningEntry,
  type ScheduleInput,
  type SchedulableWorkOrder,
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // The view is user-selectable on EVERY screen size. On phones we default to the
  // day view (the most usable on a narrow screen) and offer the switcher as a
  // compact dropdown; desktop defaults to week with the full button toggle.
  const [view, setView] = useState<CalendarViewName>(
    isMobile ? "timeGridDay" : "timeGridWeek",
  );
  const [dateWindow, setDateWindow] = useState<{ from: string; to: string } | null>(null);
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dropdown sources for the schedule dialog.
  const [workOrders, setWorkOrders] = useState<SchedulableWorkOrder[]>([]);
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
    getWorkOrdersForScheduling().then(setWorkOrders).catch(() => setWorkOrders([]));
    getAssignableEmployees().then(setEmployees).catch(() => setEmployees([]));
  }, [canManage]);

  const refresh = () => {
    if (dateWindow) load(dateWindow.from, dateWindow.to);
  };

  const selected =
    entries.find((e) => `${e.workOrderId}-${e.date}` === selectedId) ?? null;

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

  const handleSchedule = async (workOrderId: string, input: ScheduleInput) => {
    setBusy(true);
    setFormError(null);
    try {
      await scheduleWorkOrder(workOrderId, input);
      setScheduleOpen(false);
      setToast(t("planning.toast.scheduled"));
      refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("planning.toast.scheduleError"));
    } finally {
      setBusy(false);
    }
  };

  // Drag-to-reschedule: same werkbon, new date/time. Reject drops into the past.
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
      await scheduleWorkOrder(entry.workOrderId, { date, startTime, endTime });
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
      await unscheduleWorkOrder(removing.workOrderId);
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
    <Box
      sx={{
        bgcolor: SURFACE,
        // Fill the shell scroll region; a column so the calendar area flexes to
        // fill whatever height is left under the sticky TopBar (no hard-coded
        // 100dvh math that ignores the mobile bottom nav / dynamic viewport).
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TopBar
        title={t("planning.title")}
        actions={
          <PlanningActions
            view={view}
            onView={setView}
            onCreate={() => openCreate()}
            canCreate={canManage}
            compact={isMobile}
          />
        }
      />

      {error ? (
        <Box sx={{ p: PAGE_PADDING_RESPONSIVE }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "stretch", flex: 1, minHeight: 0 }}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              p: PAGE_PADDING_RESPONSIVE,
              // Clear the mobile bottom nav so the calendar's bottom row + its
              // horizontal scrollbar aren't hidden behind it.
              pb: { xs: "calc(72px + env(safe-area-inset-bottom) + 8px)", md: PAGE_PADDING_RESPONSIVE.md },
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
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
              onEventClick={(entry) => {
                const id = `${entry.workOrderId}-${entry.date}`;
                // Clicking the already-selected event deselects it.
                setSelectedId((cur) => (cur === id ? null : id));
              }}
              onDateClick={(date) => {
                // Clicking empty calendar space clears any selection; admins
                // then get the schedule dialog for that day.
                setSelectedId(null);
                if (canManage) openCreate(date);
              }}
              onEventDrop={handleDrop}
            />
          </Box>

          {/* On md+ the details live in a fixed side panel (or an empty-state
              placeholder); on xs/sm DetailsPanel renders itself as a bottom
              drawer, so we only mount the placeholder column on desktop. */}
          {selected ? (
            <DetailsPanel
              entry={selected}
              canManage={canManage}
              busy={busy}
              onClose={() => setSelectedId(null)}
              onOpenWorkOrder={() => navigate(`/work-orders/${selected.workOrderId}`)}
              onEdit={() => openEdit(selected)}
              onRemove={() => setRemoving(selected)}
            />
          ) : (
            <Box sx={{ width: 320, flexShrink: 0, p: SPACING.pagePadding, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider", display: { xs: "none", md: "block" } }}>
              <Typography color="text.secondary">{t("planning.emptyWeek")}</Typography>
            </Box>
          )}
        </Box>
      )}

      <ScheduleDialog
        open={scheduleOpen}
        workOrders={workOrders}
        employees={employees}
        lockedWorkOrder={
          editing
            ? { id: editing.workOrderId, label: `${editing.projectNumber} · ${editing.customerName}` }
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
