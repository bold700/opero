import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import type { EmployeeRow } from "../api";
import { STATUS, ROLE_LABEL_KEY, initials } from "../constants";

// The employees table card: columns + real rows, with edit/delete row actions
// (admin only).
export function EmployeesTable({
  rows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: EmployeeRow[];
  canManage: boolean;
  onEdit: (e: EmployeeRow) => void;
  onDelete: (e: EmployeeRow) => void;
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
            <TableCell>{t("employees.table.name")}</TableCell>
            <TableCell>{t("employees.table.function")}</TableCell>
            <TableCell>{t("employees.table.workOrders")}</TableCell>
            <TableCell>{t("employees.table.status")}</TableCell>
            <TableCell align="right">{t("employees.table.action")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                {t("employees.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "#FBD9A8", color: "#B45309", fontSize: 14, fontWeight: 700 }}>
                      {initials(r.name)}
                    </Avatar>
                    <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>
                  {r.function ? (ROLE_LABEL_KEY[r.function] ? t(ROLE_LABEL_KEY[r.function]) : r.function) : "—"}
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.workOrderCount}</TableCell>
                <TableCell>
                  <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
                </TableCell>
                <TableCell align="right">
                  {canManage ? (
                    <Box sx={{ display: "inline-flex", gap: 0.5 }}>
                      <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(r)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDelete(r)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
