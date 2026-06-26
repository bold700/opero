import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { canSeePrices } from "@opero/shared";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../lib/api/useApi";
import { SPACING } from "../../theme/tokens";
import {
  getWorkOrder,
  getProject,
  getWorkTypes,
  getAssignableEmployees,
  addTask,
  updateTask,
  deleteTask,
  toggleTask,
  addMaterial,
  deleteMaterial,
  toggleMaterial,
  finishWorkOrder,
  reportExtraWork,
  approveOffice,
  approveClient,
  rejectExtraWork,
  type WorkOrder,
  type Project,
  type NewExtraWork,
  type WorkTypeOption,
  type AssigneeOption,
} from "./api";
import { DetailHeader } from "./components/DetailHeader";
import { TasksPanel } from "./components/TasksPanel";
import { PhotosPanel } from "./components/PhotosPanel";
import { ExtraWorkPanel } from "./components/ExtraWorkPanel";
import { ActivityPanel } from "./components/ActivityPanel";
import { SignOffDialog } from "./components/SignOffDialog";

// Work-order detail: header + tasks + meerwerk (extra-work approval) + activity.
// The core product flow. `busy` serializes mutations; each one refetches the
// work order and the project (which carries extra-work + activity).
export function WorkOrderDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role ?? "technician") as "admin" | "technician" | "client";
  const showPrices = canSeePrices(role);

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkTypeOption[]>([]);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Initial load: work order + parent project + the per-task dropdown sources.
  // We keep them in local state so mutations refresh just what changed.
  const { loading, error } = useApi(
    useCallback(async () => {
      const w = await getWorkOrder(id);
      const p = await getProject(w.projectId);
      setWo(w);
      setProject(p);
      getWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
      getAssignableEmployees().then(setAssignees).catch(() => setAssignees([]));
      return w;
    }, [id]),
    [id],
  );

  const refreshWorkOrder = useCallback(async () => {
    setWo(await getWorkOrder(id));
  }, [id]);

  const refreshProject = useCallback(async () => {
    if (wo) setProject(await getProject(wo.projectId));
  }, [wo]);

  // Run a mutation, then refresh; surface errors as a toast.
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        setToast(e instanceof Error ? e.message : t("workOrderDetail.actionFailed"));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  if (loading) {
    return (
      <PageLayout title={t("workOrderDetail.title")}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }
  if (error || !wo || !project) {
    return (
      <PageLayout title={t("workOrderDetail.title")}>
        <Alert severity="error">{error ?? t("workOrderDetail.notFound")}</Alert>
      </PageLayout>
    );
  }

  const canWrite = role === "admin" || role === "technician";
  // Finished/locked is a property of THIS work order (signedAt), not the
  // project. A new work order on a done project is fully editable.
  const finished = Boolean(wo.signedAt);

  const handleReport = (input: NewExtraWork) =>
    run(async () => {
      await reportExtraWork(project.id, input);
      await refreshProject();
    });

  return (
    <PageLayout title={t("workOrderDetail.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        <DetailHeader
          workOrder={wo}
          project={project}
          canFinish={role === "admin" || role === "technician"}
          finished={finished}
          busy={busy}
          onBack={() => navigate("/work-orders")}
          onFinish={() => setSignOpen(true)}
        />

        <Box sx={{ display: "flex", gap: SPACING.sectionGap, flexDirection: { xs: "column", lg: "row" }, alignItems: "flex-start" }}>
          <Box sx={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
            <TasksPanel
              workOrder={wo}
              canWrite={canWrite && !finished}
              showPrices={showPrices}
              busy={busy}
              workTypes={workTypes}
              assignees={assignees}
              onAddTask={() => run(async () => { await addTask(wo.id); await refreshWorkOrder(); })}
              onRenameTask={(taskId, description) => run(async () => { await updateTask(wo.id, taskId, { description }); await refreshWorkOrder(); })}
              onSetTaskType={(taskId, workTypeId) => run(async () => { await updateTask(wo.id, taskId, { workTypeId }); await refreshWorkOrder(); })}
              onAssignTask={(taskId, assigneeId) => run(async () => { await updateTask(wo.id, taskId, { assigneeId }); await refreshWorkOrder(); })}
              onDeleteTask={(taskId) => run(async () => { await deleteTask(wo.id, taskId); await refreshWorkOrder(); })}
              onToggleTask={(taskId) => run(async () => { await toggleTask(wo.id, taskId); await refreshWorkOrder(); })}
              onAddMaterial={(taskId, m) => run(async () => { await addMaterial(wo.id, taskId, m); await refreshWorkOrder(); })}
              onDeleteMaterial={(m) => run(async () => { await deleteMaterial(wo.id, m); await refreshWorkOrder(); })}
              onToggleMaterial={(m) => run(async () => { await toggleMaterial(wo.id, m); await refreshWorkOrder(); })}
            />

            <PhotosPanel />

            <ExtraWorkPanel
              items={project.extraWork}
              role={role}
              showPrices={showPrices}
              busy={busy}
              onReport={handleReport}
              onApproveOffice={(mw) => run(async () => { await approveOffice(project.id, mw); await refreshProject(); })}
              onApproveClient={(mw) => run(async () => { await approveClient(project.id, mw); await refreshProject(); })}
              onReject={(mw) => run(async () => { await rejectExtraWork(project.id, mw); await refreshProject(); })}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <ActivityPanel activity={project.activity} />
          </Box>
        </Box>
      </Box>

      <SignOffDialog
        open={signOpen}
        busy={busy}
        onClose={() => setSignOpen(false)}
        onConfirm={(signature) =>
          run(async () => {
            await finishWorkOrder(wo.id, signature);
            await refreshWorkOrder();
            await refreshProject();
            setSignOpen(false);
            setToast(t("workOrderDetail.finishedToast"));
          })
        }
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
      />
    </PageLayout>
  );
}
