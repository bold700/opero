import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { useTranslation } from "react-i18next";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { AccountStatusChip } from "../../users/components/AccountStatusChip";
import type { Customer } from "../api";
import { avatarColor, initials, formatDate } from "../constants";
import { TypeBadge } from "./TypeBadge";

// The customers list: a table on desktop (md+), a stack of cards on mobile (xs–sm)
// via ResponsiveList. Edit/delete/invite row actions are admin only.
export function CustomersTable({
  customers,
  canManage,
  onEdit,
  onDelete,
  onInvite,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  customers: Customer[];
  canManage: boolean;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
  onInvite: (c: Customer) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useTranslation();

  const nameCell = (c: Customer) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(c.name), fontSize: 13, fontWeight: 700 }}>
        {initials(c.name)}
      </Avatar>
      <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
    </Box>
  );

  const loginCell = (c: Customer) =>
    c.account ? (
      <AccountStatusChip account={c.account} />
    ) : canManage ? (
      <Button
        size="small"
        onClick={() => onInvite(c)}
        disabled={!c.email}
        title={!c.email ? t("customers.table.loginNeedsEmail") : undefined}
      >
        {t("customers.table.invite")}
      </Button>
    ) : (
      <AccountStatusChip account={null} />
    );

  const actionsCell = (c: Customer) =>
    canManage ? (
      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
        <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(c)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDelete(c)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    ) : null;

  return (
    <ResponsiveList
      items={customers}
      keyOf={(c) => c.id}
      empty={t("customers.table.empty")}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      columns={[
        { header: t("customers.table.name"), cell: nameCell },
        { header: t("customers.table.city"), cell: (c) => <Box sx={{ color: "text.secondary" }}>{c.city}</Box> },
        { header: t("customers.table.type"), cell: (c) => <TypeBadge type={c.type} /> },
        { header: t("customers.table.workOrders"), cell: (c) => <Box sx={{ color: "text.secondary" }}>{c.workOrderCount}</Box> },
        { header: t("customers.table.lastContact"), cell: (c) => <Box sx={{ color: "text.secondary" }}>{formatDate(c.lastContact)}</Box> },
        { header: t("customers.table.login"), cell: loginCell },
        { header: t("customers.table.action"), align: "right", cell: actionsCell },
      ]}
      renderCard={(c) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {/* Top line: identity + actions */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            {nameCell(c)}
            {actionsCell(c)}
          </Box>
          {/* Meta line: city + type + work-order count */}
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, color: "text.secondary", fontSize: 13 }}>
            {c.city ? <span>{c.city}</span> : null}
            {c.city ? <span>·</span> : null}
            <TypeBadge type={c.type} />
            <span>·</span>
            <span>{t("customers.table.workOrders")}: {c.workOrderCount}</span>
          </Box>
          {/* Last contact + login row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", color: "text.secondary", fontSize: 13 }}>
            <span>{t("customers.table.lastContact")}: {formatDate(c.lastContact)}</span>
            {loginCell(c)}
          </Box>
        </Box>
      )}
    />
  );
}
