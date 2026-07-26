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
import { PageLayout } from "../../components/PageLayout";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import { ResponsiveList } from "../../components/ResponsiveList";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { STATUS_TONES, SPACING } from "../../theme/tokens";
import { STATUS as WORK_ORDER_STATUS } from "../../features/work-orders/constants";
import type { WorkOrderStatus } from "../../features/work-orders/api";
import { useApi } from "../../lib/api/useApi";
import { useAuth } from "../../auth/AuthContext";
import { canSeeAllProjects } from "@opero/shared";
import {
  getProject,
  updateProject,
  deleteProject,
  createWorkOrderForProject,
  deleteWorkOrder,
  type ProjectDetail as ProjectDetailType,
  type ProjectWorkOrder,
} from "./api";
import { PROJECT_STATUS_TONES, euro } from "./constants";
import { ProjectFormDialog } from "./components/ProjectFormDialog";

// Project detail — the grouping view: header + info + the project's werkbonnen.
// Open a werkbon → its detail. Add a werkbon under this project. Admin edits /
// deletes the project (delete cascades all its werkbonnen).
export function ProjectDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canSeeAllProjects(user?.role ?? "client");

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
      navigate(`/work-orders/${wo.id}`);
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

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );

  return (
    <PageLayout title={t("projects.title")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: SPACING.sectionGap }}>
        {actionError ? <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert> : null}

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
              <StatusBadge label={t(`projects.status.${project.status}`)} tone={PROJECT_STATUS_TONES[project.status]} />
            </Box>
            <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
              {project.customerName} · {project.address}, {project.city}
            </Typography>
          </Box>
          {canManage ? (
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
              <IconButton aria-label={t("common.actions.edit")} onClick={() => setEditOpen(true)} disabled={busy}>
                <EditOutlinedIcon />
              </IconButton>
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
            {canManage ? (
              <Button size="small" startIcon={<AddIcon />} onClick={addWorkOrder} disabled={busy}>
                {t("projects.detail.newWorkOrder")}
              </Button>
            ) : null}
          </Box>
          <ResponsiveList<ProjectWorkOrder>
            items={project.workOrders}
            keyOf={(w) => w.id}
            empty={t("projects.detail.noWorkOrders")}
            onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
            columns={[
              { header: t("projects.detail.woTitle"), cell: (w) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{woLabel(w)}</Typography> },
              { header: t("projects.detail.woStatus"), cell: (w) => woBadge(w) },
              { header: t("projects.detail.woDate"), cell: (w) => <Box sx={{ color: "text.secondary" }}>{w.plannedDate ?? "—"}</Box> },
              { header: t("projects.table.value"), align: "right", cell: (w) => (w.value != null ? <Box sx={{ fontWeight: 600 }}>{euro(w.value)}</Box> : null) },
              ...(canManage
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
                    {w.value != null ? <Typography variant="body2" sx={{ fontWeight: 600 }}>{euro(w.value)}</Typography> : null}
                    {canManage ? (
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
              <Field label={t("projects.form.customer")}>{project.customerName}</Field>
              <Field label={t("projects.detail.address")}>{project.address}, {project.postalCode} {project.city}</Field>
              {project.workTypeName ? <Field label={t("projects.form.workType")}>{project.workTypeName}</Field> : null}
              {project.contactName || project.contactPhone ? (
                <Field label={t("projects.detail.contact")}>{[project.contactName, project.contactPhone].filter(Boolean).join(" · ")}</Field>
              ) : null}
            </Box>
            {project.description ? (
              <Field label={t("projects.form.description")}>
                <Box component="span" sx={{ whiteSpace: "pre-line" }}>{project.description}</Box>
              </Field>
            ) : null}
            {project.instructions ? (
              <Field label={t("projects.detail.instructions")}>
                <Box component="span" sx={{ whiteSpace: "pre-line" }}>{project.instructions}</Box>
              </Field>
            ) : null}
          </Box>
        </Card>
      </Box>

      {canManage ? (
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
