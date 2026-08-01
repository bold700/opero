import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import {
  canSeePrices,
  canSeeMargin,
  canEditQuoteScope,
  isStaff,
  type UserRole,
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
  getProject,
  getProjectActivity,
  getAssignableEmployees,
  setWorkOrderAssignees,
  setWorkOrderSchedule,
  setWorkOrderTitle,
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
  type AssigneeOption,
  type ProjectSidebarPatch,
} from "./api";
import { DetailHeader } from "./components/DetailHeader";
import { TasksPanel } from "./components/TasksPanel";
import { PreJobPanel } from "./components/PreJobPanel";
import { ProjectInfoPanel } from "./components/ProjectInfoPanel";
import { ProjectInfoSheet } from "./components/ProjectInfoSheet";
import { MeerwerkApprovalPanel } from "./components/MeerwerkApprovalPanel";
import { AttachmentsPanel } from "./components/AttachmentsPanel";
import { ActivityPanel } from "./components/ActivityPanel";
import { ActivitySheet } from "./components/ActivitySheet";
import { SignOffDialog } from "./components/SignOffDialog";

// Work-order detail: header + tasks + meerwerk (extra-work approval) + activity.
// The core product flow. `busy` serializes mutations; each one refetches the
// work order and the project (which carries extra-work + activity).
export function WorkOrderDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
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
  const theme = useTheme();
  const sidePanelsInSheet = useMediaQuery(theme.breakpoints.down("lg"));
  const [infoOpen, setInfoOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

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
  const canWrite = isStaff(role);
  const canEditScope = canEditQuoteScope(role);
  // Adding/removing a ZONE is office work — a subset of scope editing.
  const canManageZones = canEditScope;
  // Finished/locked is a property of THIS work order (signedAt), not the
  // project. A new work order on a done project is fully editable.
  const finished = Boolean(wo.signedAt);

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
    onPatch: (patch: ProjectSidebarPatch) =>
      run(async () => {
        setProject(await updateProject(project.id, patch));
      }),
    onAssignMonteurs: (ids: string[]) =>
      run(async () => { setWo(await setWorkOrderAssignees(wo.id, ids)); }),
    onSetSchedule: (patch: { plannedDate?: string | null; plannedEndDate?: string | null }) =>
      run(async () => { setWo(await setWorkOrderSchedule(wo.id, patch)); }),
    onSetTitle: (title: string) =>
      run(async () => { setWo(await setWorkOrderTitle(wo.id, title)); }),
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

  return (
    <PageLayout title={t("workOrderDetail.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        <DetailHeader
          workOrder={wo}
          project={project}
          canDelete={canEditQuoteScope(role)}
          canFinish={isStaff(role)}
          canReopen={canEditQuoteScope(role)}
          canExportQuote={canEditQuoteScope(role)}
          finished={finished}
          busy={busy}
          exporting={exporting}
          exportingQuote={exportingQuote}
          onBack={() => navigate("/work-orders")}
          // Only where the panels aren't on screen; the icons hide themselves at lg+.
          onOpenInfo={sidePanelsInSheet ? () => setInfoOpen(true) : undefined}
          onOpenActivity={sidePanelsInSheet ? () => setActivityOpen(true) : undefined}
          onDelete={handleDelete}
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

        {/* Stacked below lg, two columns above.
            `alignItems` is per-direction on purpose: it targets the CROSS axis,
            so "flex-start" (which we want on desktop, to stop the columns
            stretching to equal height) means "shrink to content WIDTH" once the
            container is a column — that's what left a ragged gap on the right
            and made the cards size to their content instead of the screen. */}
        <Box
          sx={{
            display: "flex",
            gap: SPACING.sectionGap,
            flexDirection: { xs: "column", lg: "row" },
            alignItems: { xs: "stretch", lg: "flex-start" },
          }}
        >
          {/* Left / main: the werkbon body (zones + extra work).
              Same trap for `flex`: the shorthand sets flex-basis, which is the
              MAIN axis — height while stacked. Only apply the 3:2 ratio at lg,
              and pin width:100% below it so the column can never be sized by
              its widest child. */}
          <Box
            sx={{
              flex: { xs: "0 0 auto", lg: 3 },
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
              onEditLine={(m, input) => run(async () => { await updateMaterial(wo.id, m, input); await refreshWorkOrder(); })}
              // Editing a free-text line: clear any catalog link and write the
              // typed fields. unitPrice omitted (non-admin) leaves it as-is.
              onEditCustomLine={(m, input) => run(async () => { await updateMaterial(wo.id, m, { variantId: null, name: input.name, label: input.name, quantity: input.quantity, unit: input.unit, ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}), ...(input.isExtraWork !== undefined ? { isExtraWork: input.isExtraWork } : {}) }); await refreshWorkOrder(); })}
              onDeleteLine={(m) => run(async () => { await deleteMaterial(wo.id, m); await refreshWorkOrder(); })}
              onToggleLine={(m) => run(async () => { await toggleMaterial(wo.id, m); await refreshWorkOrder(); })}
              onChangeLineQuantity={(m, quantity) => run(async () => { await updateMaterial(wo.id, m, { quantity }); await refreshWorkOrder(); })}
              onUploadPhoto={(taskId, kind, file) => run(async () => { setWo(await uploadTaskPhoto(wo.id, taskId, kind, file)); })}
              onDeletePhoto={(taskId, key) => run(async () => { setWo(await deleteTaskPhoto(wo.id, taskId, key)); })}
            />

            {/* Meerwerk awaiting YOUR approval, gathered from every zone. The
                lines themselves live inline in their zone; this is the action
                surface (and the client's only one), so it renders only when
                something is actually waiting. */}
            <MeerwerkApprovalPanel
              workOrder={wo}
              role={role}
              showPrices={showPrices}
              busy={busy}
              onApproveOffice={(matId) => run(async () => { await approveOffice(wo.id, matId); await refreshWorkOrder(); })}
              onApproveClient={(matId) => run(async () => { await approveClient(wo.id, matId); await refreshWorkOrder(); })}
              onReject={(matId) => run(async () => { await rejectExtraWork(wo.id, matId); await refreshWorkOrder(); })}
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
          {/* Same per-direction flex as the main column — see the note above. */}
          <Box
            sx={{
              flex: { xs: "0 0 auto", lg: 2 },
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

            {/* Below lg this lives in a sheet behind the header's info icon —
                inline it would sit ~3 screens down, past the whole werkbon. */}
            {sidePanelsInSheet ? null : <ProjectInfoPanel {...projectInfoProps} />}

            {/* Same treatment — below lg this is the header's history icon. */}
            {sidePanelsInSheet ? null : <ActivityPanel activity={project.activity} />}
          </Box>
        </Box>
      </Box>

      {sidePanelsInSheet ? (
        <>
          <ProjectInfoSheet
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            {...projectInfoProps}
          />
          <ActivitySheet
            open={activityOpen}
            onClose={() => setActivityOpen(false)}
            activity={project.activity}
          />
        </>
      ) : null}

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
