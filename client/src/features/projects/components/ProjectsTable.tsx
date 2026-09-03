import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { useTranslation } from "react-i18next";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { StatusBadge } from "../../../components/StatusBadge";
import type { ProjectSummary } from "../api";
import { PROJECT_STATUS_TONES, euro } from "../constants";

// The projects list: table on desktop, cards on mobile. A row opens the project
// detail; edit/delete are admin row actions.
export function ProjectsTable({
  projects,
  canManage,
  onOpen,
  onEdit,
  onDelete,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  projects: ProjectSummary[];
  canManage: boolean;
  onOpen: (p: ProjectSummary) => void;
  onEdit: (p: ProjectSummary) => void;
  onDelete: (p: ProjectSummary) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useTranslation();

  const statusCell = (p: ProjectSummary) => (
    <StatusBadge label={t(`projects.status.${p.status}`)} tone={PROJECT_STATUS_TONES[p.status]} />
  );

  // Project number + the CLIENT's reference number as a labelled subtitle
  // (labelled, so the two numbers in this cell are never confused with each
  // other). The project's own name has its own column on desktop.
  const numberCell = (p: ProjectSummary) => (
    <Box>
      <Typography sx={{ fontWeight: 600 }}>{p.projectNumber}</Typography>
      {p.referenceNumber ? (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
          {t("projects.detail.referenceShort", { number: p.referenceNumber })}
        </Typography>
      ) : null}
    </Box>
  );

  const actionsCell = (p: ProjectSummary) =>
    canManage ? (
      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
        <IconButton
          size="small"
          aria-label={t("common.actions.edit")}
          onClick={(e) => { e.stopPropagation(); onEdit(p); }}
        >
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label={t("common.actions.delete")}
          onClick={(e) => { e.stopPropagation(); onDelete(p); }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    ) : null;

  return (
    <ResponsiveList
      items={projects}
      keyOf={(p) => p.id}
      empty={t("projects.table.empty")}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      onRowClick={onOpen}
      columns={[
        { header: t("projects.table.number"), cell: numberCell },
        { header: t("projects.table.name"), cell: (p) => (p.name ? <Box>{p.name}</Box> : null) },
        { header: t("projects.table.customer"), cell: (p) => <Box sx={{ color: "text.secondary" }}>{p.customerName}</Box> },
        { header: t("projects.table.city"), cell: (p) => <Box sx={{ color: "text.secondary" }}>{p.city}</Box> },
        { header: t("projects.table.workOrders"), cell: (p) => <Box sx={{ color: "text.secondary" }}>{p.workOrderCount}</Box> },
        { header: t("projects.table.status"), cell: statusCell },
        {
          header: t("projects.table.value"),
          align: "right",
          cell: (p) => (p.value != null ? <Box sx={{ fontWeight: 600 }}>{euro(p.value)}</Box> : null),
        },
        { header: t("projects.table.action"), align: "right", cell: actionsCell },
      ]}
      renderCard={(p) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            {numberCell(p)}
            {actionsCell(p)}
          </Box>
          {p.name ? <Typography variant="body2">{p.name}</Typography> : null}
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, color: "text.secondary", fontSize: 13 }}>
            <span>{p.customerName}</span>
            {p.city ? <><span>·</span><span>{p.city}</span></> : null}
            <span>·</span>
            <span>{t("projects.table.workOrders")}: {p.workOrderCount}</span>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            {statusCell(p)}
            {p.value != null ? <Typography sx={{ fontWeight: 600 }}>{euro(p.value)}</Typography> : null}
          </Box>
        </Box>
      )}
    />
  );
}
