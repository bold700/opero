import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import { ACCOUNT_STATUS, initials } from "../constants";
import { UserRowMenu } from "./UserRowMenu";
import type { UserAccount } from "../api";

// The access table: one row per login account, its role + status, and the
// lifecycle actions appropriate to that status (resend / disable / enable).
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
  return (
    <Card noPadding>
      <Table
        sx={{
          "& th, & td": { borderColor: "#F0EDF1", px: 3 },
          "& th": { py: 2 },
          "& td": { py: 2 },
        }}
      >
        <TableHead>
          <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
            <TableCell>{t("users.table.name")}</TableCell>
            <TableCell>{t("users.table.role")}</TableCell>
            <TableCell>{t("users.table.status")}</TableCell>
            <TableCell align="right">{t("users.table.action")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                {t("users.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((u) => {
              const status = ACCOUNT_STATUS[u.status];
              const busy = busyId === u.id;
              return (
                <TableRow key={u.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                  <TableCell>
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
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {t(`users.roles.${u.role}`)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={t(status.labelKey)} tone={status.tone} />
                  </TableCell>
                  <TableCell align="right">
                    <UserRowMenu
                      user={u}
                      isSelf={u.id === currentUserId}
                      busy={busy}
                      onResend={onResend}
                      onDisable={onDisable}
                      onEnable={onEnable}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
