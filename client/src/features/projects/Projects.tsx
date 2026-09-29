import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { PageLayout } from "../../components/PageLayout";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FilterSideSheet } from "../../components/FilterSideSheet";
import { useAuth } from "../../auth/AuthContext";
import { isOffice, canSeePrices } from "@opero/shared";
import { usePagedApi } from "../../lib/api/usePagedApi";
import { useDebounced } from "../../lib/useDebounced";
import { useCreateParam } from "../../lib/useCreateParam";
import {
  getProjectsPage,
  createProject,
  deleteProject,
  archiveProject,
  restoreProject,
  type ProjectSummary,
  type ProjectInput,
  type ProjectVisibility,
} from "./api";
import { ProjectsActions } from "./components/ProjectsActions";
import { ProjectsFilterBar } from "./components/ProjectsFilterBar";
import { ProjectsTable } from "./components/ProjectsTable";
import { ProjectFormDialog } from "./components/ProjectFormDialog";

// Projects — the grouping layer. List every project; open one to see its
// werkbonnen. The office manages; the foreman reads (all projects, no prices).
// Technicians/clients work at the werkbon level.
export function Projects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role ?? "client";
  const canManage = isOffice(role);
  const showPrices = canSeePrices(role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("active");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebounced(search, 300);

  const { items, loading, loadingMore, error, hasMore, loadMore } = usePagedApi<ProjectSummary>(
    (cursor) =>
      getProjectsPage({
        cursor,
        search: debouncedSearch || undefined,
        lifecycleStatus: statusFilter || undefined,
        archived: visibility,
      }),
    [debouncedSearch, statusFilter, visibility, reloadKey],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [archiving, setArchiving] = useState<ProjectSummary | null>(null);
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

  const handleArchive = async () => {
    if (!archiving) return;
    setBusy(true);
    try {
      await archiveProject(archiving.id);
      setArchiving(null);
      setToast(t("projects.toast.archived"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("projects.toast.archiveError"));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (project: ProjectSummary) => {
    setBusy(true);
    try {
      await restoreProject(project.id);
      setToast(t("projects.toast.restored"));
      refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("projects.toast.restoreError"));
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
          filterAction={
            <FilterSideSheet
              open={filtersOpen}
              onOpen={() => setFiltersOpen(true)}
              onClose={() => setFiltersOpen(false)}
              activeCount={(statusFilter ? 1 : 0) + (visibility === "active" ? 0 : 1)}
              onClear={() => {
                setStatusFilter("");
                setVisibility("active");
              }}
            >
              <ProjectsFilterBar
                status={statusFilter}
                onStatusChange={setStatusFilter}
                visibility={visibility}
                onVisibilityChange={(value) => {
                  setVisibility(value);
                  if (value === "archived") setStatusFilter("");
                }}
              />
            </FilterSideSheet>
          }
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
          showPrices={showPrices}
          onOpen={(p) => navigate(`/projects/${p.id}`)}
          onEdit={(p) => navigate(`/projects/${p.id}`)}
          onArchive={setArchiving}
          onRestore={handleRestore}
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
        open={archiving !== null}
        title={t("projects.archive.title")}
        body={archiving ? t("projects.archive.body", { number: archiving.projectNumber }) : undefined}
        busy={busy}
        onClose={() => setArchiving(null)}
        onConfirm={handleArchive}
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
