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
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import type { Customer } from "../api";
import { avatarColor, initials, formatDate } from "../constants";
import { TypeBadge } from "./TypeBadge";

// The customers table card: columns + real rows, with edit/delete row actions
// (admin only).
export function CustomersTable({
  customers,
  canManage,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  canManage: boolean;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
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
            <TableCell>{t("customers.table.name")}</TableCell>
            <TableCell>{t("customers.table.city")}</TableCell>
            <TableCell>{t("customers.table.type")}</TableCell>
            <TableCell>{t("customers.table.workOrders")}</TableCell>
            <TableCell>{t("customers.table.lastContact")}</TableCell>
            <TableCell align="right">{t("customers.table.action")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                {t("customers.table.empty")}
              </TableCell>
            </TableRow>
          ) : (
            customers.map((c) => (
              <TableRow key={c.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: avatarColor(c.name), fontSize: 13, fontWeight: 700 }}>
                      {initials(c.name)}
                    </Avatar>
                    <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{c.city}</TableCell>
                <TableCell>
                  <TypeBadge type={c.type} />
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{c.workOrderCount}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{formatDate(c.lastContact)}</TableCell>
                <TableCell align="right">
                  {canManage ? (
                    <Box sx={{ display: "inline-flex", gap: 0.5 }}>
                      <IconButton size="small" aria-label={t("common.actions.edit")} onClick={() => onEdit(c)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" aria-label={t("common.actions.delete")} onClick={() => onDelete(c)}>
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
