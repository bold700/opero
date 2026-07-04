import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { StatusBadge } from "../../../components/StatusBadge";
import { ACCOUNT_STATUS, initials } from "../constants";
import { UserRowMenu } from "./UserRowMenu";
import type { UserAccount } from "../api";

// The access list: one row per login account, its role + status, and the
// lifecycle actions appropriate to that status (resend / disable / enable).
// A dense table on desktop (md+), a stack of cards on mobile (xs–sm) via
// ResponsiveList.
export function UsersTable({
  rows,
  currentUserId,
  busyId,
  onResend,
  onDisable,
  onEnable,
}: {
  rows: UserAccount[];
  currentUserId?: string;
  busyId: string | null;
  onResend: (u: UserAccount) => void;
  onDisable: (u: UserAccount) => void;
  onEnable: (u: UserAccount) => void;
}) {
  const { t } = useTranslation();

  const nameCell = (u: UserAccount) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: "#E8DEF8", color: "#6750A4", fontSize: 14, fontWeight: 700 }}>
        {initials(u.name)}
      </Avatar>
      <Box>
        <Typography sx={{ fontWeight: 600 }}>{u.name}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {u.email}
        </Typography>
      </Box>
    </Box>
  );

  const roleCell = (u: UserAccount) => t(`users.roles.${u.role}`);

  const statusCell = (u: UserAccount) => {
    const status = ACCOUNT_STATUS[u.status];
    return <StatusBadge label={t(status.labelKey)} tone={status.tone} />;
  };

  const menuCell = (u: UserAccount) => (
    <UserRowMenu
      user={u}
      isSelf={u.id === currentUserId}
      busy={busyId === u.id}
      onResend={onResend}
      onDisable={onDisable}
      onEnable={onEnable}
    />
  );

  return (
    <ResponsiveList
      items={rows}
      keyOf={(u) => u.id}
      empty={t("users.empty")}
      columns={[
        { header: t("users.table.name"), cell: nameCell },
        { header: t("users.table.role"), cell: (u) => <Box sx={{ color: "text.secondary" }}>{roleCell(u)}</Box> },
        { header: t("users.table.status"), cell: statusCell },
        { header: t("users.table.action"), align: "right", cell: menuCell },
      ]}
      renderCard={(u) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {/* Top line: identity + kebab actions */}
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            {nameCell(u)}
            {menuCell(u)}
          </Box>
          {/* Meta line: role + status */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Box sx={{ color: "text.secondary", fontSize: 13 }}>{roleCell(u)}</Box>
            {statusCell(u)}
          </Box>
        </Box>
      )}
    />
  );
}
