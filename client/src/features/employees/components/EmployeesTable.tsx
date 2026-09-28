import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { StatusBadge } from "../../../components/StatusBadge";
import { AccountStatusChip } from "../../users/components/AccountStatusChip";
import { STATUS_TONES } from "../../../theme/tokens";
import type { EmployeeRow } from "../api";
import { STATUS, ROLE_LABEL_KEY, initials } from "../constants";

// The employees list: a table on desktop, a stack of cards on mobile (via
// ResponsiveList). Row actions are the frequent ones only — absences and edit.
// Deleting someone is rare and destructive, so it lives in the edit dialog
// rather than one mis-tap away in a row you're scanning.
export function EmployeesTable({
  rows,
  canManage,
  onEdit,
  onAbsences,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: EmployeeRow[];
  canManage: boolean;
  onEdit: (e: EmployeeRow) => void;
  onAbsences: (e: EmployeeRow) => void;
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

  // Pure status — inviting/resending lives in the edit dialog's account section,
  // next to the rest of the employee's data.
  const accountCell = (r: EmployeeRow) => <AccountStatusChip account={r.account} />;

  const rolesCell = (r: EmployeeRow) => {
    const roles = r.account?.roles?.length
      ? r.account.roles
      : r.account
        ? [r.account.role]
        : [];

    return roles.length > 0 ? (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {roles.map((role) => (
          <StatusBadge key={role} label={t(`users.roles.${role}`)} tone={STATUS_TONES.neutral} />
        ))}
      </Box>
    ) : (
      <Box sx={{ color: "text.secondary" }}>—</Box>
    );
  };

  const actionsCell = (r: EmployeeRow) =>
    canManage ? (
      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
        {/* Absence periods (holiday/sick). Planning reads these to stop
            offering someone who is away. */}
        <Tooltip title={t("employees.absence.action")}>
          <IconButton
            size="small"
            aria-label={t("employees.absence.action")}
            onClick={() => onAbsences(r)}
          >
            <EventBusyOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(r)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        {/* No delete here on purpose: removing someone is rare and destructive,
            so it doesn't belong in a row you scan. It lives in the edit dialog. */}
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
        { header: t("employees.table.roles"), cell: rolesCell },
        { header: t("employees.table.workOrders"), cell: (r) => <Box sx={{ color: "text.secondary" }}>{r.workOrderCount}</Box> },
        { header: t("employees.table.status"), cell: (r) => <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} /> },
        { header: t("employees.table.account"), cell: accountCell },
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
          {rolesCell(r)}
          {/* Status + login row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
            {accountCell(r)}
          </Box>
        </Box>
      )}
    />
  );
}
