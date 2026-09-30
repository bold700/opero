import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import { PageLayout } from "../../components/PageLayout";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import { ResponsiveList } from "../../components/ResponsiveList";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ActivityPanel } from "../../components/ActivityPanel";
import { AttachmentsPanel } from "../../components/AttachmentsPanel";
import { STATUS_TONES, SPACING } from "../../theme/tokens";
import { STATUS as WORK_ORDER_STATUS } from "../../features/work-orders/constants";
import type { WorkOrderStatus } from "../../features/work-orders/api";
import { useApi } from "../../lib/api/useApi";
import { useAuth } from "../../auth/AuthContext";
import { isOffice, canSeePrices } from "@opero/shared";
import {
  getProject,
  addProjectComment,
  uploadProjectAttachment,
  deleteProjectAttachment,
  updateProject,
  deleteProject,
  archiveProject,
  restoreProject,
  createWorkOrderForProject,
  deleteWorkOrder,
  type ProjectDetail as ProjectDetailType,
  type ProjectWorkOrder,
} from "./api";
import { PROJECT_LIFECYCLE_STATUS_TONES, euro } from "./constants";
import { ProjectFormDialog } from "./components/ProjectFormDialog";
import { ProjectInfoField } from "./components/ProjectInfoField";

// Project detail — the grouping view: header + info + the project's werkbonnen.
// Open a werkbon → its detail. Add a werkbon under this project. Admin edits /
// deletes the project (delete cascades all its werkbonnen). The foreman reads
// it without the value column (the server omits prices for him anyway).
export function ProjectDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const canManage = isOffice(role);
  const showPrices = canSeePrices(role);

  const [project, setProject] = useState<ProjectDetailType | null>(null);
  const { loading, error } = useApi(
    async () => {
      const p = await getProject(id);
      setProject(p);
      return p;
    },
    [id],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deletingWo, setDeletingWo] = useState<ProjectWorkOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <PageLayout title={t("projects.title")}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }
  if (error || !project) {
    return (
      <PageLayout title={t("projects.title")}>
        <Alert severity="error">{error ?? t("projects.detail.notFound")}</Alert>
      </PageLayout>
    );
  }

  const woLabel = (w: ProjectWorkOrder) =>
    w.title.trim() || t("projects.detail.workOrderDefault", { n: w.ordinal + 1 });
  const woSummary = (w: ProjectWorkOrder) => {
    const description = w.description?.trim();
    if (description) return description;
    const taskNames = (w.taskNames ?? []).filter(Boolean);
    const visibleTasks = taskNames.slice(0, 2).join(" · ");
    const remaining = taskNames.length - 2;
    return remaining > 0
      ? t("projects.detail.moreTasks", { summary: visibleTasks, count: remaining })
      : visibleTasks;
  };
  const canArchive = project.workOrders.every((workOrder) => workOrder.signed);

  // Werkbon status badge — reuses the SAME label + colour map as the werkbonnen
  // list (open=lavender, on the way=blue, urgent=red, done=green); "signed" wins.
  const woBadge = (w: ProjectWorkOrder) => {
    if (w.signed) {
      return <StatusBadge label={t("projects.detail.woSigned")} tone={STATUS_TONES.success} />;
    }
    const meta = WORK_ORDER_STATUS[w.status as WorkOrderStatus];
    return meta ? (
      <StatusBadge label={t(meta.labelKey)} tone={meta.tone} />
    ) : (
      <StatusBadge label={w.status} tone={STATUS_TONES.neutral} />
    );
  };

  const addWorkOrder = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const wo = await createWorkOrderForProject(project.id);
      navigate(`/work-orders/${wo.id}`, { state: { projectId: project.id } });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("projects.toast.saveError"));
      setBusy(false);
    }
  };

  const runDelete = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteProject(project.id);
      navigate("/projects");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("projects.toast.deleteError"));
      setBusy(false);
    }
  };

  const runArchive = async () => {
    setBusy(true);
    setActionError(null);
    try {
      setProject(await archiveProject(project.id));
      setArchiveOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("projects.toast.archiveError"));
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    setBusy(true);
    setActionError(null);
    try {
      setProject(await restoreProject(project.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("projects.toast.restoreError"));
    } finally {
      setBusy(false);
    }
  };

  // Delete one werkbon, then refetch the project so its list + count update.
  const runDeleteWorkOrder = async () => {
    if (!deletingWo) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteWorkOrder(deletingWo.id);
      setDeletingWo(null);
      setProject(await getProject(project.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("projects.toast.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout title={t("projects.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        {actionError ? <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert> : null}
        {project.archived ? <Alert severity="info">{t("projects.detail.archivedNotice")}</Alert> : null}

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <IconButton aria-label={t("common.actions.back")} onClick={() => navigate("/projects")} sx={{ mt: -0.5, ml: -1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {project.name || project.projectNumber}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>{project.projectNumber}</Typography>
              {/* The client's own reference, labelled so it can't be mistaken
                  for Opero's projectNumber next to it. */}
              {project.referenceNumber ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("projects.detail.referenceShort", { number: project.referenceNumber })}
                </Typography>
              ) : null}
              <StatusBadge
                label={t(`projects.lifecycleStatus.${project.lifecycleStatus}`)}
                tone={PROJECT_LIFECYCLE_STATUS_TONES[project.lifecycleStatus]}
              />
            </Box>
            <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
              {project.customerName} · {project.address}, {project.city}
            </Typography>
          </Box>
          {canManage ? (
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
              {!project.archived ? (
                <IconButton aria-label={t("common.actions.edit")} onClick={() => setEditOpen(true)} disabled={busy}>
                  <EditOutlinedIcon />
                </IconButton>
              ) : null}
              {project.archived || canArchive ? (
                <IconButton
                  aria-label={t(project.archived ? "projects.actions.restore" : "projects.actions.archive")}
                  onClick={project.archived ? runRestore : () => setArchiveOpen(true)}
                  disabled={busy}
                >
                  {project.archived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />}
                </IconButton>
              ) : null}
              <IconButton aria-label={t("common.actions.delete")} onClick={() => setDeleteOpen(true)} disabled={busy}>
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          ) : null}
        </Box>

        {/* Werkbonnen — the visits this project groups. */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("projects.detail.workOrders")}</Typography>
            {canManage && !project.archived ? (
              <Button size="small" startIcon={<AddIcon />} onClick={addWorkOrder} disabled={busy}>
                {t("projects.detail.newWorkOrder")}
              </Button>
            ) : null}
          </Box>
          <ResponsiveList<ProjectWorkOrder>
            items={project.workOrders}
            keyOf={(w) => w.id}
            empty={t("projects.detail.noWorkOrders")}
            onRowClick={(w) =>
              navigate(`/work-orders/${w.id}`, { state: { projectId: project.id } })
            }
            columns={[
              {
                header: t("projects.detail.woTitle"),
                sortValue: (w) => `${woLabel(w)} ${woSummary(w)}`,
                cell: (w) => (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{woLabel(w)}</Typography>
                    {woSummary(w) ? (
                      <Typography variant="body2" color="text.secondary">{woSummary(w)}</Typography>
                    ) : null}
                    {(w.assigneeNames?.length ?? 0) > 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        {w.assigneeNames?.join(", ")}
                      </Typography>
                    ) : null}
                  </Box>
                ),
              },
              { header: t("projects.detail.woStatus"), sortValue: (w) => w.status, cell: (w) => woBadge(w) },
              { header: t("projects.detail.woDate"), sortValue: (w) => w.plannedDate, cell: (w) => <Box sx={{ color: "text.secondary" }}>{w.plannedDate ?? "—"}</Box> },
              ...(showPrices
                ? [{
                    header: t("projects.table.value"),
                    align: "right" as const,
                    sortValue: (w: ProjectWorkOrder) => w.value,
                    cell: (w: ProjectWorkOrder) => (w.value != null ? <Box sx={{ fontWeight: 600 }}>{euro(w.value)}</Box> : null),
                  }]
                : []),
              ...(canManage && !project.archived
                ? [{
                    header: "",
                    align: "right" as const,
                    cell: (w: ProjectWorkOrder) => (
                      <IconButton
                        size="small"
                        aria-label={t("common.actions.delete")}
                        onClick={(e) => { e.stopPropagation(); setDeletingWo(w); }}
                        disabled={busy}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    ),
                  }]
                : []),
            ]}
            renderCard={(w) => (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{woLabel(w)}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {showPrices && w.value != null ? <Typography variant="body2" sx={{ fontWeight: 600 }}>{euro(w.value)}</Typography> : null}
                    {canManage && !project.archived ? (
                      <IconButton
                        size="small"
                        aria-label={t("common.actions.delete")}
                        onClick={(e) => { e.stopPropagation(); setDeletingWo(w); }}
                        disabled={busy}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Box>
                </Box>
                {woSummary(w) ? (
                  <Typography variant="body2" color="text.secondary">{woSummary(w)}</Typography>
                ) : null}
                {(w.assigneeNames?.length ?? 0) > 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {w.assigneeNames?.join(", ")}
                  </Typography>
                ) : null}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", fontSize: 13 }}>
                  {woBadge(w)}
                  <span>·</span>
                  <span>{w.plannedDate ?? "—"}</span>
                </Box>
              </Box>
            )}
          />
        </Box>

        {/* Project info */}
        <Card>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("projects.detail.info")}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <ProjectInfoField label={t("projects.form.customer")}>{project.customerName}</ProjectInfoField>
              <ProjectInfoField label={t("projects.detail.address")}>{project.address}, {project.postalCode} {project.city}</ProjectInfoField>
              {/* Opero's own number and the client's reference sit side by side
                  on purpose — they are different numbers for the same job. */}
              <ProjectInfoField label={t("projects.table.number")}>{project.projectNumber}</ProjectInfoField>
              {project.referenceNumber ? (
                <ProjectInfoField label={t("projects.form.referenceNumber")}>{project.referenceNumber}</ProjectInfoField>
              ) : null}
              {project.contactName || project.contactPhone ? (
                <ProjectInfoField label={t("projects.detail.contact")}>{[project.contactName, project.contactPhone].filter(Boolean).join(" · ")}</ProjectInfoField>
              ) : null}
              {project.contacts.length > 0 ? (
                <ProjectInfoField label={t("projects.form.contacts")}>
                  {project.contacts
                    .map((c) => [c.name, c.role, c.phone].filter(Boolean).join(" · "))
                    .join(", ")}
                </ProjectInfoField>
              ) : null}
            </Box>
            {project.description ? (
              <ProjectInfoField label={t("projects.form.description")}>
                <Box component="span" sx={{ whiteSpace: "pre-line" }}>{project.description}</Box>
              </ProjectInfoField>
            ) : null}
            {project.instructions ? (
              <ProjectInfoField label={t("projects.detail.instructions")}>
                <Box component="span" sx={{ whiteSpace: "pre-line" }}>{project.instructions}</Box>
              </ProjectInfoField>
            ) : null}
          </Box>
        </Card>

        {/* Project files — visible from every werkbon in this project. */}
        <AttachmentsPanel
          attachments={project.attachments}
          canWrite={canManage && !project.archived}
          busy={busy}
          title={t("projects.attachments.title")}
          emptyText={t("projects.attachments.empty")}
          addLabel={t("projects.attachments.add")}
          onUpload={(file) => {
            setBusy(true);
            uploadProjectAttachment(project.id, file)
              .then(setProject)
              .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
          onDelete={(attachmentId) => {
            setBusy(true);
            deleteProjectAttachment(project.id, attachmentId)
              .then(setProject)
              .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
        />

        {/* Activity — the project's timeline (comments + system events), the
            same feed the werkbon detail page shows. */}
        <ActivityPanel
          activity={project.activity}
          onAddComment={
            project.archived
              ? undefined
              : async (body) => {
                  const activity = await addProjectComment(project.id, body);
                  setProject((p) => (p ? { ...p, activity } : p));
                }
          }
        />
      </Box>

      {canManage && !project.archived ? (
        <ProjectFormDialog
          open={editOpen}
          project={project}
          busy={busy}
          error={actionError}
          onClose={() => setEditOpen(false)}
          onCreate={() => {}}
          onUpdate={async (patch) => {
            setBusy(true);
            setActionError(null);
            try {
              setProject(await updateProject(project.id, patch));
              setEditOpen(false);
            } catch (e) {
              setActionError(e instanceof Error ? e.message : t("projects.toast.saveError"));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        title={t("projects.archive.title")}
        body={t("projects.archive.body", { number: project.projectNumber })}
        busy={busy}
        onClose={() => setArchiveOpen(false)}
        onConfirm={runArchive}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t("projects.delete.title")}
        body={t("projects.delete.body", { number: project.projectNumber, count: project.workOrders.length })}
        busy={busy}
        destructive
        onClose={() => setDeleteOpen(false)}
        onConfirm={runDelete}
      />

      <ConfirmDialog
        open={deletingWo !== null}
        title={t("projects.detail.deleteWorkOrderTitle")}
        body={deletingWo ? t("projects.detail.deleteWorkOrderBody", { name: woLabel(deletingWo) }) : undefined}
        busy={busy}
        destructive
        onClose={() => setDeletingWo(null)}
        onConfirm={runDeleteWorkOrder}
      />
    </PageLayout>
  );
}
