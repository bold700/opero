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
  setWorkOrderAssignees,
  setWorkOrderSchedule,
  updateProject,
  addTask,
  updateTask,
  deleteTask,
  reorderTasks,
  toggleTask,
  addMaterialFromCatalog,
  addCustomMaterial,
  updateMaterial,
  deleteMaterial,
  toggleMaterial,
  uploadTaskPhoto,
  deleteTaskPhoto,
  finishWorkOrder,
  reopenWorkOrder,
  reportExtraWork,
  reportExtraWorkFromCatalog,
  updateExtraWork,
  uploadAttachment,
  deleteAttachment,
  approveOffice,
  approveClient,
  rejectExtraWork,
  uploadExtraWorkPhoto,
  deleteExtraWorkPhoto,
  updatePrejobItem,
  addPrejobItem,
  reorderPrejobItems,
  deletePrejobItem,
  setPrejobPhotoRequired,
  uploadPrejobPhoto,
  deletePrejobPhoto,
  dispatchWorkOrder,
  type WorkOrder,
  type Project,
  type NewExtraWork,
  type AssigneeOption,
  type ProjectSidebarPatch,
} from "./api";
import { DetailHeader } from "./components/DetailHeader";
import { TasksPanel } from "./components/TasksPanel";
import { PreJobPanel } from "./components/PreJobPanel";
import { ProjectInfoPanel } from "./components/ProjectInfoPanel";
import { ExtraWorkPanel } from "./components/ExtraWorkPanel";
import { AttachmentsPanel } from "./components/AttachmentsPanel";
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
  // 3-way price rule across the whole werkbon (task lines + meerwerk):
  // admin → price + margin, client → price only, technician → no price.
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

  // Two different kinds of "write", deliberately kept apart:
  //   canWrite     — REGISTER what happened on site: tick lines done, set used
  //                  quantities, notes, photos, report meerwerk. Technicians too.
  //   canEditScope — change what was SOLD: line description/quantity/price,
  //                  add or delete lines, zone title/work-type/assignee. Office
  //                  only, because all of it moves the invoiced amount.
  // The backend enforces the same split field-by-field (requireQuoteScopeEditor
  // + the *_SCOPE_FIELDS lists in work-orders/routes.ts); this just keeps the UI
  // from offering a technician buttons that would 403.
  const canWrite = role === "admin" || role === "technician";
  const canEditScope = role === "admin";
  // Adding/removing a ZONE is office work — a subset of scope editing.
  const canManageZones = canEditScope;
  // Finished/locked is a property of THIS work order (signedAt), not the
  // project. A new work order on a done project is fully editable.
  const finished = Boolean(wo.signedAt);

  const handleReport = (input: NewExtraWork) =>
    run(async () => {
      await reportExtraWork(wo.id, input);
      await refreshWorkOrder();
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
          canReopen={role === "admin"}
          canExportQuote={role === "admin"}
          finished={finished}
          busy={busy}
          exporting={exporting}
          exportingQuote={exportingQuote}
          onBack={() => navigate("/work-orders")}
          onExportPdf={handleExportPdf}
          onExportQuotePdf={handleExportQuotePdf}
          onFinish={() => setSignOpen(true)}
          onReopen={() =>
            run(async () => {
              setWo(await reopenWorkOrder(wo.id));
              await refreshProject();
              setToast(t("workOrderDetail.reopenedToast"));
            })
          }
        />

        <Box sx={{ display: "flex", gap: SPACING.sectionGap, flexDirection: { xs: "column", lg: "row" }, alignItems: "flex-start" }}>
          {/* Left / main: the werkbon body (zones + extra work). */}
          <Box sx={{ flex: 3, minWidth: 0, display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
            <TasksPanel
              workOrder={wo}
              canWrite={canWrite && !finished}
              canEditScope={canEditScope && !finished}
              canManageZones={canManageZones && !finished}
              showPrices={showPrices}
              showMargin={showMargin}
              busy={busy}
              onAddZone={() => run(async () => { await addTask(wo.id); await refreshWorkOrder(); })}
              onReorderZones={(activeTaskId, overTaskId) => run(async () => { setWo(await reorderTasks(wo.id, activeTaskId, overTaskId)); })}
              onRenameZone={(taskId, description) => run(async () => { await updateTask(wo.id, taskId, { description }); await refreshWorkOrder(); })}
              onSetZoneNote={(taskId, note) => run(async () => { await updateTask(wo.id, taskId, { note }); await refreshWorkOrder(); })}
              onDeleteZone={(taskId) => run(async () => { await deleteTask(wo.id, taskId); await refreshWorkOrder(); })}
              onAddLine={(taskId, input) => run(async () => { await addMaterialFromCatalog(wo.id, taskId, input); await refreshWorkOrder(); })}
              onAddCustomLine={(taskId, input) => run(async () => { await addCustomMaterial(wo.id, taskId, input); await refreshWorkOrder(); })}
              onEditLine={(m, input) => run(async () => { await updateMaterial(wo.id, m, input); await refreshWorkOrder(); })}
              // Editing a free-text line: clear any catalog link and write the
              // typed fields. unitPrice omitted (non-admin) leaves it as-is.
              onEditCustomLine={(m, input) => run(async () => { await updateMaterial(wo.id, m, { variantId: null, name: input.name, label: input.name, quantity: input.quantity, unit: input.unit, ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}) }); await refreshWorkOrder(); })}
              onDeleteLine={(m) => run(async () => { await deleteMaterial(wo.id, m); await refreshWorkOrder(); })}
              onToggleLine={(m) => run(async () => { await toggleMaterial(wo.id, m); await refreshWorkOrder(); })}
              onChangeLineQuantity={(m, quantity) => run(async () => { await updateMaterial(wo.id, m, { quantity }); await refreshWorkOrder(); })}
              onUploadPhoto={(taskId, kind, file) => run(async () => { setWo(await uploadTaskPhoto(wo.id, taskId, kind, file)); })}
              onDeletePhoto={(taskId, key) => run(async () => { setWo(await deleteTaskPhoto(wo.id, taskId, key)); })}
            />

            <ExtraWorkPanel
              items={wo.extraWork}
              role={role}
              showPrices={showPrices}
              showMargin={showMargin}
              busy={busy}
              onReport={handleReport}
              onReportFromCatalog={(input) => run(async () => { await reportExtraWorkFromCatalog(wo.id, input); await refreshWorkOrder(); })}
              onUpdate={(mw, input) => run(async () => { await updateExtraWork(wo.id, mw, input); await refreshWorkOrder(); })}
              onUpdateFromCatalog={(mw, input) => run(async () => { await updateExtraWork(wo.id, mw, input); await refreshWorkOrder(); })}
              onApproveOffice={(mw) => run(async () => { await approveOffice(wo.id, mw); await refreshWorkOrder(); })}
              onApproveClient={(mw) => run(async () => { await approveClient(wo.id, mw); await refreshWorkOrder(); })}
              onReject={(mw) => run(async () => { await rejectExtraWork(wo.id, mw); await refreshWorkOrder(); })}
              onUploadPhoto={(mw, file) => run(async () => { await uploadExtraWorkPhoto(wo.id, mw, file); await refreshWorkOrder(); })}
              onDeletePhoto={(mw, key) => run(async () => { await deleteExtraWorkPhoto(wo.id, mw, key); await refreshWorkOrder(); })}
            />

            <AttachmentsPanel
              attachments={wo.attachments}
              canWrite={canWrite && !finished}
              busy={busy}
              onUpload={(file) => run(async () => { setWo(await uploadAttachment(wo.id, file)); })}
              onDelete={(attachmentId) => run(async () => { setWo(await deleteAttachment(wo.id, attachmentId)); })}
            />
          </Box>

          {/* Right / side: separate cards — Controle vooraf, Projectinfo, Activiteit. */}
          <Box sx={{ flex: 2, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
            <PreJobPanel
              workOrder={wo}
              isAdmin={role === "admin"}
              busy={busy}
              onToggleCheck={(itemId, done) => run(async () => { setWo(await updatePrejobItem(wo.id, itemId, { done })); })}
              onRenameItem={(itemId, label) => run(async () => { setWo(await updatePrejobItem(wo.id, itemId, { label })); })}
              onAddItem={(label) => run(async () => { setWo(await addPrejobItem(wo.id, label)); })}
              onRemoveItem={(itemId) => run(async () => { setWo(await deletePrejobItem(wo.id, itemId)); })}
              onMoveItem={(orderedIds) => run(async () => { setWo(await reorderPrejobItems(wo.id, orderedIds)); })}
              onSetPhotoRequired={(required) => run(async () => { setWo(await setPrejobPhotoRequired(wo.id, required)); })}
              onUploadPhoto={(file) => run(async () => { setWo(await uploadPrejobPhoto(wo.id, file)); })}
              onDeletePhoto={(key) => run(async () => { setWo(await deletePrejobPhoto(wo.id, key)); })}
              onDispatch={() =>
                run(async () => {
                  setWo(await dispatchWorkOrder(wo.id));
                  setToast(t("workOrderDetail.prejob.dispatchedToast"));
                })
              }
            />

            <ProjectInfoPanel
              project={project}
              workOrder={wo}
              canEdit={role === "admin"}
              busy={busy}
              employees={assignees}
              onPatch={(patch: ProjectSidebarPatch) =>
                run(async () => {
                  setProject(await updateProject(project.id, patch));
                })
              }
              onAssignMonteurs={(ids) => run(async () => { setWo(await setWorkOrderAssignees(wo.id, ids)); })}
              onSetSchedule={(patch) => run(async () => { setWo(await setWorkOrderSchedule(wo.id, patch)); })}
            />

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
