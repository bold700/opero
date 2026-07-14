import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { canSeePrices, canSeeMargin } from "@opero/shared";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../lib/api/useApi";
import { SPACING } from "../../theme/tokens";
import {
  getWorkOrder,
  exportWorkOrderPdf,
  exportWorkOrderQuotePdf,
  getProject,
  getAssignableEmployees,
  setWorkOrderAssignee,
  addTask,
  updateTask,
  deleteTask,
  toggleTask,
  addMaterialFromCatalog,
  updateMaterial,
  deleteMaterial,
  toggleMaterial,
  uploadTaskPhoto,
  deleteTaskPhoto,
  finishWorkOrder,
  reportExtraWork,
  approveOffice,
  approveClient,
  rejectExtraWork,
  uploadExtraWorkPhoto,
  deleteExtraWorkPhoto,
  setPrejobCheck,
  uploadPrejobPhoto,
  deletePrejobPhoto,
  dispatchWorkOrder,
  type WorkOrder,
  type Project,
  type NewExtraWork,
  type AssigneeOption,
} from "./api";
import { DetailHeader } from "./components/DetailHeader";
import { TasksPanel } from "./components/TasksPanel";
import { PreJobPanel } from "./components/PreJobPanel";
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
  const showMargin = canSeeMargin(role);

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingQuote, setExportingQuote] = useState(false);
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

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const filename = `werkbon-${project.projectNumber}-${wo.ordinal + 1}.pdf`;
      await exportWorkOrderPdf(wo.id, filename);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("workOrderDetail.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const handleExportQuotePdf = async () => {
    setExportingQuote(true);
    try {
      // The server names the file after the assigned quote number via
      // Content-Disposition; this is the client-side fallback name.
      const filename = `offerte-${project.projectNumber}-${wo.ordinal + 1}.pdf`;
      await exportWorkOrderQuotePdf(wo.id, filename);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("workOrderDetail.exportFailed"));
    } finally {
      setExportingQuote(false);
    }
  };

  return (
    <PageLayout title={t("workOrderDetail.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        <DetailHeader
          workOrder={wo}
          project={project}
          canFinish={role === "admin" || role === "technician"}
          canExportQuote={role === "admin"}
          canAssign={role === "admin"}
          assignees={assignees}
          finished={finished}
          busy={busy}
          exporting={exporting}
          exportingQuote={exportingQuote}
          onBack={() => navigate("/work-orders")}
          onExportPdf={handleExportPdf}
          onExportQuotePdf={handleExportQuotePdf}
          onFinish={() => setSignOpen(true)}
          onAssign={(assigneeId) => run(async () => { setWo(await setWorkOrderAssignee(wo.id, assigneeId)); })}
        />

        <Box sx={{ display: "flex", gap: SPACING.sectionGap, flexDirection: { xs: "column", lg: "row" }, alignItems: "flex-start" }}>
          <Box sx={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
            <TasksPanel
              workOrder={wo}
              canWrite={canWrite && !finished}
              showPrices={showPrices}
              showMargin={showMargin}
              busy={busy}
              onAddZone={() => run(async () => { await addTask(wo.id); await refreshWorkOrder(); })}
              onRenameZone={(taskId, description) => run(async () => { await updateTask(wo.id, taskId, { description }); await refreshWorkOrder(); })}
              onSetZoneNote={(taskId, note) => run(async () => { await updateTask(wo.id, taskId, { note }); await refreshWorkOrder(); })}
              onDeleteZone={(taskId) => run(async () => { await deleteTask(wo.id, taskId); await refreshWorkOrder(); })}
              onAddLine={(taskId, input) => run(async () => { await addMaterialFromCatalog(wo.id, taskId, input); await refreshWorkOrder(); })}
              onDeleteLine={(m) => run(async () => { await deleteMaterial(wo.id, m); await refreshWorkOrder(); })}
              onToggleLine={(m) => run(async () => { await toggleMaterial(wo.id, m); await refreshWorkOrder(); })}
              onChangeLineQuantity={(m, quantity) => run(async () => { await updateMaterial(wo.id, m, { quantity }); await refreshWorkOrder(); })}
              onChangeLineLabel={(m, label) => run(async () => { await updateMaterial(wo.id, m, { label }); await refreshWorkOrder(); })}
              onUploadPhoto={(taskId, kind, file) => run(async () => { setWo(await uploadTaskPhoto(wo.id, taskId, kind, file)); })}
              onDeletePhoto={(taskId, key) => run(async () => { setWo(await deleteTaskPhoto(wo.id, taskId, key)); })}
            />

            <PreJobPanel
              workOrder={wo}
              isAdmin={role === "admin"}
              busy={busy}
              onToggleCheck={(key, done) =>
                run(async () => {
                  setWo(await setPrejobCheck(wo.id, key, done));
                })
              }
              onUploadPhoto={(file) =>
                run(async () => {
                  setWo(await uploadPrejobPhoto(wo.id, file));
                })
              }
              onDeletePhoto={(key) =>
                run(async () => {
                  setWo(await deletePrejobPhoto(wo.id, key));
                })
              }
              onDispatch={() =>
                run(async () => {
                  setWo(await dispatchWorkOrder(wo.id));
                  setToast(t("workOrderDetail.prejob.dispatchedToast"));
                })
              }
            />

            <ExtraWorkPanel
              items={project.extraWork}
              role={role}
              showPrices={showPrices}
              busy={busy}
              onReport={handleReport}
              onApproveOffice={(mw) => run(async () => { await approveOffice(project.id, mw); await refreshProject(); })}
              onApproveClient={(mw) => run(async () => { await approveClient(project.id, mw); await refreshProject(); })}
              onReject={(mw) => run(async () => { await rejectExtraWork(project.id, mw); await refreshProject(); })}
              onUploadPhoto={(mw, file) => run(async () => { await uploadExtraWorkPhoto(project.id, mw, file); await refreshProject(); })}
              onDeletePhoto={(mw, key) => run(async () => { await deleteExtraWorkPhoto(project.id, mw, key); await refreshProject(); })}
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
        onConfirm={(signatureImage, signedByName) =>
          run(async () => {
            setWo(await finishWorkOrder(wo.id, signatureImage, signedByName));
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
