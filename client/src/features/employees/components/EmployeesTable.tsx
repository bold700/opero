import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { StatusBadge } from "../../../components/StatusBadge";
import { AccountStatusChip } from "../../users/components/AccountStatusChip";
import type { EmployeeRow } from "../api";
import { STATUS, ROLE_LABEL_KEY, initials } from "../constants";

// The employees list: a table on desktop, a stack of cards on mobile (via
// ResponsiveList). Edit/delete/invite row actions are admin only.
export function EmployeesTable({
  rows,
  canManage,
  onEdit,
  onDelete,
  onInvite,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: EmployeeRow[];
  canManage: boolean;
  onEdit: (e: EmployeeRow) => void;
  onDelete: (e: EmployeeRow) => void;
  onInvite: (e: EmployeeRow) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useTranslation();

  const fn = (r: EmployeeRow) =>
    r.function ? (ROLE_LABEL_KEY[r.function] ? t(ROLE_LABEL_KEY[r.function]) : r.function) : "—";

  const nameCell = (r: EmployeeRow) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: "#FBD9A8", color: "#B45309", fontSize: 14, fontWeight: 700 }}>
        {initials(r.name)}
      </Avatar>
      <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography>
    </Box>
  );

  const loginCell = (r: EmployeeRow) =>
    r.account ? (
      <AccountStatusChip account={r.account} />
    ) : canManage ? (
      <Button
        size="small"
        onClick={() => onInvite(r)}
        disabled={!r.email}
        title={!r.email ? t("employees.table.loginNeedsEmail") : undefined}
      >
        {t("employees.table.invite")}
      </Button>
    ) : (
      <AccountStatusChip account={null} />
    );

  const actionsCell = (r: EmployeeRow) =>
    canManage ? (
      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
        <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(r)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDelete(r)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    ) : null;

  return (
    <ResponsiveList
      items={rows}
      keyOf={(r) => r.id}
      empty={t("employees.empty")}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      columns={[
        { header: t("employees.table.name"), cell: nameCell },
        { header: t("employees.table.function"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{fn(r)}</Box> },
        { header: t("employees.table.workOrders"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.workOrderCount}</Box> },
        { header: t("employees.table.status"), cell: (r) => <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} /> },
        { header: t("employees.table.login"), cell: loginCell },
        { header: t("employees.table.action"), align: "right", cell: actionsCell },
      ]}
      renderCard={(r) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {/* Top line: identity + actions */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            {nameCell(r)}
            {actionsCell(r)}
          </Box>
          {/* Meta line: function + work-order count */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, color: "text.secondary", fontSize: 13 }}>
            <span>{fn(r)}</span>
            <span>·</span>
            <span>{t("employees.table.workOrders")}: {r.workOrderCount}</span>
          </Box>
          {/* Status + login row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
            {loginCell(r)}
          </Box>
        </Box>
      )}
    />
  );
}
