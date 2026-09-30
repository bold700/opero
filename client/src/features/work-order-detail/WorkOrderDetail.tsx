import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import {
  canSeePrices,
  canSeeMargin,
  canEditQuoteScope,
  isStaff,
  type UserRole,
  type WorkOrderStatus,
} from "@opero/shared";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../lib/api/useApi";
import { SPACING } from "../../theme/tokens";
import {
  getWorkOrder,
  deleteWorkOrder,
  exportWorkOrderPdf,
  exportWorkOrderQuotePdf,
  exportWorkOrderInvoicePdf,
  getProject,
  getProjectActivity,
  getMentionCandidates,
  addProjectComment,
  getAssignableEmployees,
  setWorkOrderAssignees,
  setWorkOrderContacts,
  setWorkOrderSchedule,
  setWorkOrderTitle,
  setWorkOrderUrgency,
  setWorkOrderDescription,
  updateProject,
  addTask,
  startTask,
  endTask,
  setTaskHours,
  updateTask,
  deleteTask,
  reorderTasks,
  addMaterialFromCatalog,
  addCustomMaterial,
  addMaterialFromArticle,
  registerMaterialStock,
  logMaterialProgress,
  deleteMaterialProgress,
  updateMaterial,
  deleteMaterial,
  toggleMaterial,
  uploadTaskPhoto,
  deleteTaskPhoto,
  finishWorkOrder,
  approveWorkOrder,
  setWorkOrderStatus,
  prepareWorkOrderInvoice,
  sendWorkOrderInvoice,
  markWorkOrderInvoicePaid,
  uploadAttachment,
  deleteAttachment,
  setAttachmentReceived,
  approveOffice,
  approveClient,
  rejectExtraWork,
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
  type AssigneeOption,
  type MentionCandidate,
  type ProjectSidebarPatch,
} from "./api";
import { DetailHeader } from "./components/DetailHeader";
import { TasksPanel } from "./components/TasksPanel";
import { PreJobPanel } from "./components/PreJobPanel";
import { ProjectInfoSheet } from "./components/ProjectInfoSheet";
import { MeerwerkApprovalPanel } from "./components/MeerwerkApprovalPanel";
import { ActivitySheet } from "./components/ActivitySheet";
import { NotesSheet } from "./components/NotesSheet";
import { AttachmentsSheet } from "./components/AttachmentsSheet";
import { SignOffDialog } from "./components/SignOffDialog";
import { WorkOrderLifecycleTimeline } from "./components/WorkOrderLifecycleTimeline";
import { STATUS } from "../work-orders/constants";

// Work-order detail: header + tasks + meerwerk (extra-work approval) + activity.
// The core product flow. `busy` serializes mutations; each one refetches the
// work order and the project (which carries extra-work + activity).
export function WorkOrderDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hintedProjectId = (location.state as { projectId?: string } | null)?.projectId;
  const { user } = useAuth();
  // Do NOT re-narrow this to a literal union: a cast would silently swallow any
  // role not listed and drop it into the least-privileged branch below.
  const role: UserRole = user?.role ?? "technician";
  // 3-way price rule across the whole werkbon (task lines + meerwerk):
  // admin → price + margin, client → price only, technician → no price.
  const showPrices = canSeePrices(role);
  const showMargin = canSeeMargin(role);

  // Below lg the two-column layout collapses, so Projectinfo and Activiteit —
  // the two reference panels you consult rather than work in — move into sheets
  // reachable from the header. Matches the breakpoint of the layout itself
  // (see the flexDirection below), NOT the usual sm "mobile" — on a tablet the
  // sidebar is already gone and the panels are just as buried.
  const [infoOpen, setInfoOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  // Two role-filtered lists: the project-leader picker and the monteur picker
  // ask for different job titles, so they can't share one fetch.
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [projectLeaders, setProjectLeaders] = useState<AssigneeOption[]>([]);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingQuote, setExportingQuote] = useState(false);
  const [exportingInvoice, setExportingInvoice] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Initial load: work order + parent project + the per-task dropdown sources.
  // We keep them in local state so mutations refresh just what changed.
  const { loading, error } = useApi(
    useCallback(async () => {
      // Internal links already know the parent project. Fetch both aggregates
      // together instead of waiting for the werkbon before starting the project
      // request. Direct/bookmarked URLs retain the safe sequential fallback.
      const [w, hintedProject] = hintedProjectId
        ? await Promise.all([getWorkOrder(id), getProject(hintedProjectId)])
        : [await getWorkOrder(id), null];
      const p =
        hintedProject?.id === w.projectId ? hintedProject : await getProject(w.projectId);
      setWo(w);
      setProject(p);
      getMentionCandidates(p.id).then(setMentionCandidates).catch(() => setMentionCandidates([]));
      getAssignableEmployees("technician").then(setAssignees).catch(() => setAssignees([]));
      getAssignableEmployees("project_leader")
        .then(setProjectLeaders)
        .catch(() => setProjectLeaders([]));
      return w;
    }, [hintedProjectId, id]),
    [hintedProjectId, id],
  );

  // Nearly every mutation writes a ProjectActivity row (see appendActivity
  // calls in the backend work-order routes), so refreshing the work order
  // also refreshes the activity feed — otherwise the panel only updates on
  // a full page reload.
  const refreshWorkOrder = useCallback(async () => {
    const [w, activity] = await Promise.all([getWorkOrder(id), getProjectActivity(project?.id ?? "")]);
    setWo(w);
    setProject((p) => (p ? { ...p, activity } : p));
  }, [id, project?.id]);

  const refreshProject = useCallback(async () => {
    if (wo) setProject(await getProject(wo.projectId));
  }, [wo]);

  // Post a note onto the project timeline; the endpoint returns the refreshed
  // feed, so no second round-trip.
  const addComment = useCallback(
    async (body: string, mentionUserIds: string[] = []) => {
      if (!project || !wo) return;
      const activity = await addProjectComment(project.id, body, {
        mentionUserIds,
        workOrderId: wo.id,
      });
      setProject((p) => (p ? { ...p, activity } : p));
    },
    [project, wo],
  );

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
  // Dispatch gate: a technician sees an assigned werkbon before it is
  // dispatched, but can't register anything on it until the office releases it
  // ("Monteur op pad sturen"). Mirrors requireWritableWorkOrder server-side;
  // office/foreman logins are not gated.
  const dispatchBlocked = role === "technician" && !wo.dispatchedAt;
  const canWrite = isStaff(role) && !dispatchBlocked;
  const canEditScope = canEditQuoteScope(role);
  // Adding/removing a ZONE is office work — a subset of scope editing.
  const canManageZones = canEditScope;
  // Finished/locked is a property of THIS work order (signedAt), not the
  // project. A new work order on a done project is fully editable.
  const finished = Boolean(wo.signedAt);
  const nextStatusByStatus: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
    open: "released",
    planned: "released",
    released: "ready_for_review",
    in_progress: "ready_for_review",
    ready_for_review: "approved",
    approved: "ready_to_invoice",
    ready_to_invoice: "invoiced",
    invoiced: "completed",
  };
  const nextStatus = wo.status === "ready_for_review" && !finished
    ? "ready_for_review"
    : nextStatusByStatus[wo.status];
  const fieldWorkerCanAdvance =
    isStaff(role) &&
    !dispatchBlocked &&
    (["released", "in_progress"].includes(wo.status) ||
      (wo.status === "ready_for_review" && !finished));
  const canAdvance = canEditScope || fieldWorkerCanAdvance;

  const workflowAction = nextStatus && canAdvance
    ? {
        label: t("workOrderDetail.header.toStatus", {
          status: t(STATUS[nextStatus].labelKey),
        }),
        disabled: ["open", "planned"].includes(wo.status) && !wo.canDispatch,
        onClick: () => {
          if (["released", "in_progress"].includes(wo.status) ||
              (wo.status === "ready_for_review" && !finished)) {
            setSignOpen(true);
            return;
          }
          run(async () => {
            if (["open", "planned"].includes(wo.status)) {
              setWo(await dispatchWorkOrder(wo.id));
            } else if (wo.status === "ready_for_review") {
              setWo(await approveWorkOrder(wo.id));
            } else if (wo.status === "approved") {
              await prepareWorkOrderInvoice(wo.id);
              await refreshWorkOrder();
            } else if (wo.status === "ready_to_invoice") {
              await sendWorkOrderInvoice(wo.id);
              await refreshWorkOrder();
            } else if (wo.status === "invoiced") {
              await markWorkOrderInvoicePaid(wo.id);
              await refreshWorkOrder();
            }
            await refreshProject();
            setToast(t("workOrderDetail.header.advancedToast", {
              status: t(STATUS[nextStatus].labelKey),
            }));
          });
        },
      }
    : undefined;

  const changeStatus = (status: WorkOrderStatus) =>
    run(async () => {
      if (status === "ready_to_invoice") {
        await prepareWorkOrderInvoice(wo.id);
      } else if (status === "invoiced") {
        if (wo.invoiceStatus === "not_started" || wo.invoiceStatus === "paid") {
          await prepareWorkOrderInvoice(wo.id);
        }
        await sendWorkOrderInvoice(wo.id);
      } else if (status === "completed") {
        if (wo.invoiceStatus === "not_started") {
          await prepareWorkOrderInvoice(wo.id);
          await sendWorkOrderInvoice(wo.id);
        } else if (wo.invoiceStatus === "draft") {
          await sendWorkOrderInvoice(wo.id);
        }
        await markWorkOrderInvoicePaid(wo.id);
      } else {
        setWo(await setWorkOrderStatus(wo.id, status));
      }
      await refreshWorkOrder();
      await refreshProject();
      setToast(t("workOrderDetail.info.statusChangedToast", {
        status: t(STATUS[status].labelKey),
      }));
    });

  // One definition, two possible homes — the sidebar or the sheet — so the two
  // can't drift. Rendered in exactly ONE of them: the panel has uncontrolled
  // defaultValue/onBlur inputs and fetches customers on mount, so two mounted
  // copies would double that request and let the fields desync.
  const projectInfoProps = {
    project,
    workOrder: wo,
    canEdit: canEditScope,
    busy,
    employees: assignees,
    projectLeaders,
    onPatch: (patch: ProjectSidebarPatch) =>
      run(async () => {
        setProject(await updateProject(project.id, patch));
      }),
    onAssignMonteurs: (ids: string[]) =>
      run(async () => { setWo(await setWorkOrderAssignees(wo.id, ids)); }),
    onSetSchedule: (patch: {
      plannedDate?: string | null;
      plannedEndDate?: string | null;
      startTime?: string;
      endTime?: string;
    }) =>
      run(async () => { setWo(await setWorkOrderSchedule(wo.id, patch)); }),
    onSetUrgency: (urgency: "normal" | "urgent") =>
      run(async () => { setWo(await setWorkOrderUrgency(wo.id, urgency)); }),
    onSetTitle: (title: string) =>
      run(async () => { setWo(await setWorkOrderTitle(wo.id, title)); }),
    onSetDescription: (description: string) =>
      run(async () => { setWo(await setWorkOrderDescription(wo.id, description)); }),
    onSetContacts: (contactPersonIds: string[]) =>
      run(async () => { setWo(await setWorkOrderContacts(wo.id, contactPersonIds)); }),
    onSetStatus: changeStatus,
  };

  // Delete the whole werkbon, then leave — the page we're on no longer exists.
  // `replace` so Back doesn't return to a 404.
  const handleDelete = () =>
    run(async () => {
      await deleteWorkOrder(wo.id);
      navigate("/work-orders", { replace: true });
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

  const handleExportInvoicePdf = async () => {
    setExportingInvoice(true);
    try {
      await exportWorkOrderInvoicePdf(wo.id, `factuur-${project.projectNumber}-${wo.ordinal + 1}.pdf`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("workOrderDetail.exportFailed"));
    } finally {
      setExportingInvoice(false);
    }
  };

  return (
    <PageLayout title={t("workOrderDetail.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        {/* Why the werkbon is read-only for this monteur, stated before anything
            else on the page. Office releases it with "Monteur op pad sturen". */}
        {dispatchBlocked && !finished ? (
          <Alert severity="info">{t("workOrderDetail.notDispatched")}</Alert>
        ) : null}

        <DetailHeader
          workOrder={wo}
          project={project}
          canDelete={canEditQuoteScope(role)}
          canExportQuote={canEditQuoteScope(role)}
          canExportInvoice={canEditQuoteScope(role) && wo.invoiceStatus !== "not_started"}
          finished={finished}
          busy={busy}
          exporting={exporting}
          exportingQuote={exportingQuote}
          exportingInvoice={exportingInvoice}
          onBack={() => navigate("/work-orders")}
          onOpenInfo={() => setInfoOpen(true)}
          onOpenAttachments={() => setAttachmentsOpen(true)}
          onOpenNotes={() => setNotesOpen(true)}
          onOpenActivity={() => setActivityOpen(true)}
          attachmentCount={
            wo.attachments.length +
            wo.tasks.reduce(
              (count, task) => count + task.beforePhotos.length + task.resultPhotos.length,
              0,
            )
          }
          noteCount={project.activity.filter((entry) => entry.type === "comment").length}
          workflowAction={workflowAction}
          onDelete={handleDelete}
          onExportPdf={handleExportPdf}
          onExportQuotePdf={handleExportQuotePdf}
          onExportInvoicePdf={handleExportInvoicePdf}
        />

        {/* Tasks and controls stay on the page. Reference information opens in
            focused side sheets from the compact header navigation. */}
        <Box
          sx={{
            display: "flex",
            gap: SPACING.sectionGap,
            flexDirection: { xs: "column", lg: "row" },
            alignItems: { xs: "stretch", lg: "flex-start" },
          }}
        >
          <Box
            sx={{
              flex: { xs: "0 0 auto", lg: 3 },
              order: { xs: 1, lg: 0 },
              width: { xs: "100%", lg: "auto" },
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: SPACING.sectionGap,
            }}
          >
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
              onAddArticleLine={(taskId, input) => run(async () => { await addMaterialFromArticle(wo.id, taskId, input); await refreshWorkOrder(); })}
              onEditLine={(material, input) => run(async () => { await updateMaterial(wo.id, material, input); await refreshWorkOrder(); })}
              onEditCustomLine={(material, input) => run(async () => { await updateMaterial(wo.id, material, { variantId: null, name: input.name, label: input.name, quantity: input.quantity, unit: input.unit, ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}), ...(input.isExtraWork !== undefined ? { isExtraWork: input.isExtraWork } : {}) }); await refreshWorkOrder(); })}
              onDeleteLine={(material) => run(async () => { await deleteMaterial(wo.id, material); await refreshWorkOrder(); })}
              onToggleLine={(material) => run(async () => { await toggleMaterial(wo.id, material); await refreshWorkOrder(); })}
              onChangeLineQuantity={(material, quantity) => run(async () => { await updateMaterial(wo.id, material, { quantity }); await refreshWorkOrder(); })}
              onRegisterStock={(material, input) => run(async () => { await registerMaterialStock(wo.id, material, input); await refreshWorkOrder(); })}
              onLogProgress={(material, input) => run(async () => { await logMaterialProgress(wo.id, material, input); await refreshWorkOrder(); })}
              onDeleteProgress={(material, entryId) => run(async () => { await deleteMaterialProgress(wo.id, material, entryId); await refreshWorkOrder(); })}
              onUploadPhoto={(taskId, kind, file) => run(async () => { setWo(await uploadTaskPhoto(wo.id, taskId, kind, file)); })}
              onDeletePhoto={(taskId, key) => run(async () => { setWo(await deleteTaskPhoto(wo.id, taskId, key)); })}
              onStartTimer={(taskId) => run(async () => { setWo(await startTask(wo.id, taskId)); })}
              onEndTimer={(taskId) => run(async () => { await endTask(wo.id, taskId); await refreshWorkOrder(); })}
              onSetHours={(taskId, hours) => run(async () => { await setTaskHours(wo.id, taskId, hours); await refreshWorkOrder(); })}
            />

            <MeerwerkApprovalPanel
              workOrder={wo}
              role={role}
              showPrices={showPrices}
              busy={busy}
              onApproveOffice={(materialId) => run(async () => { await approveOffice(wo.id, materialId); await refreshWorkOrder(); })}
              onApproveClient={(materialId) => run(async () => { await approveClient(wo.id, materialId); await refreshWorkOrder(); })}
              onReject={(materialId) => run(async () => { await rejectExtraWork(wo.id, materialId); await refreshWorkOrder(); })}
            />
          </Box>

          <Box
            sx={{
              flex: { xs: "0 0 auto", lg: 2 },
              order: { xs: 0, lg: 1 },
              width: "100%",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: SPACING.sectionGap,
            }}
          >
            <PreJobPanel
              workOrder={wo}
              isAdmin={canEditQuoteScope(role)}
              canComplete={isStaff(role)}
              busy={busy}
              onToggleCheck={(itemId, done) => run(async () => { setWo(await updatePrejobItem(wo.id, itemId, { done })); })}
              onRenameItem={(itemId, label) => run(async () => { setWo(await updatePrejobItem(wo.id, itemId, { label })); })}
              onAddItem={(label) => run(async () => { setWo(await addPrejobItem(wo.id, label)); })}
              onRemoveItem={(itemId) => run(async () => { setWo(await deletePrejobItem(wo.id, itemId)); })}
              onMoveItem={(orderedIds) => run(async () => { setWo(await reorderPrejobItems(wo.id, orderedIds)); })}
              onSetPhotoRequired={(required) => run(async () => { setWo(await setPrejobPhotoRequired(wo.id, required)); })}
              onUploadPhoto={(file) => run(async () => { setWo(await uploadPrejobPhoto(wo.id, file)); })}
              onDeletePhoto={(key) => run(async () => { setWo(await deletePrejobPhoto(wo.id, key)); })}
            />
            <WorkOrderLifecycleTimeline phase={wo.phase} status={wo.status} />
          </Box>
        </Box>
      </Box>

      <ProjectInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        {...projectInfoProps}
      />
      <AttachmentsSheet
        open={attachmentsOpen}
        onClose={() => setAttachmentsOpen(false)}
        attachments={wo.attachments}
        tasks={wo.tasks}
        canWrite={canWrite && !finished}
        busy={busy}
        onUploadAttachment={(file) => run(async () => { setWo(await uploadAttachment(wo.id, file)); })}
        onUploadPackingSlip={(file) => run(async () => { setWo(await uploadAttachment(wo.id, file, "packing_slip")); })}
        onDelete={(attachmentId) => run(async () => { setWo(await deleteAttachment(wo.id, attachmentId)); })}
        onSetReceived={(attachmentId, received) => run(async () => { setWo(await setAttachmentReceived(wo.id, attachmentId, received)); })}
      />
      <NotesSheet
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={project.activity.filter((entry) => entry.type === "comment")}
        mentionCandidates={mentionCandidates}
        onAddNote={addComment}
      />
      <ActivitySheet
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        activity={project.activity.filter((entry) => entry.type !== "comment")}
      />
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
