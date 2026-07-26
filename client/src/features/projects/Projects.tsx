import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { PageLayout } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../auth/AuthContext";
import { canSeeAllProjects } from "@opero/shared";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getProjectsPage,
  createProject,
  deleteProject,
  type ProjectSummary,
  type ProjectInput,
} from "./api";
import { ProjectsActions } from "./components/ProjectsActions";
import { ProjectsTable } from "./components/ProjectsTable";
import { ProjectFormDialog } from "./components/ProjectFormDialog";

// Projects — the grouping layer. List every project; open one to see its
// werkbonnen. Admin-only (technicians/clients work at the werkbon level).
export function Projects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canSeeAllProjects(user?.role ?? "client");

  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebounced(search, 300);

  const { items, loading, loadingMore, error, hasMore, loadMore } = usePagedApi<ProjectSummary>(
    (cursor) => getProjectsPage({ cursor, search: debouncedSearch || undefined }),
    [debouncedSearch, reloadKey],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => setReloadKey((k) => k + 1);

  const openCreate = () => {
    setFormError(null);
    setCreateOpen(true);
  };
  useCreateParam(openCreate, canManage);

  const handleCreate = async (input: ProjectInput) => {
    setBusy(true);
    setFormError(null);
    try {
      const created = await createProject(input);
      setCreateOpen(false);
      setToast(t("projects.toast.created"));
      navigate(`/projects/${created.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t("projects.toast.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProject(deleting.id);
      setDeleting(null);
      setToast(t("projects.toast.deleted"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("projects.toast.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout
      title={t("projects.title")}
      actions={
        <ProjectsActions
          search={search}
          onSearch={setSearch}
          onCreate={openCreate}
          canCreate={canManage}
        />
      }
    >
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <ProjectsTable
          projects={items}
          canManage={canManage}
          onOpen={(p) => navigate(`/projects/${p.id}`)}
          onEdit={(p) => navigate(`/projects/${p.id}`)}
          onDelete={setDeleting}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}

      <ProjectFormDialog
        open={createOpen}
        busy={busy}
        error={formError}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        onUpdate={() => {}}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("projects.delete.title")}
        body={deleting ? t("projects.delete.body", { number: deleting.projectNumber, count: deleting.workOrderCount }) : undefined}
        busy={busy}
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
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
