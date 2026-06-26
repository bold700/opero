import { useTranslation } from "react-i18next";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import type { WorkOrderRow } from "../api";
import { STATUS, formatDate } from "../constants";

// The work orders table card: columns + real rows. Row / eye click opens the
// work-order detail.
export function WorkOrdersTable({
  rows,
  onOpen,
}: {
  rows: WorkOrderRow[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card noPadding>
      <Table
        sx={{
          "& th, & td": { borderColor: "#F0EDF1", px: 3 },
          "& th": { py: 2 },
          "& td": { py: 2.25 },
        }}
      >
        <TableHead>
          <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
            <TableCell>{t("workOrders.table.number")}</TableCell>
            <TableCell>{t("workOrders.table.customer")}</TableCell>
            <TableCell>{t("workOrders.table.location")}</TableCell>
            <TableCell>{t("workOrders.table.workType")}</TableCell>
            <TableCell>{t("workOrders.table.technician")}</TableCell>
            <TableCell>{t("workOrders.table.status")}</TableCell>
            <TableCell>{t("workOrders.table.date")}</TableCell>
            <TableCell align="right">{t("workOrders.table.action")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                {t("workOrders.table.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow
                key={r.id}
                hover
                onClick={() => onOpen(r.id)}
                sx={{ cursor: "pointer", "&:last-child td": { border: 0 } }}
              >
                <TableCell sx={{ fontWeight: 700 }}>{r.number}</TableCell>
                <TableCell>{r.customerName}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.city}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.workType}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.technician}</TableCell>
                <TableCell>
                  <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{formatDate(r.date)}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t("workOrders.table.viewAria")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(r.id);
                    }}
                  >
                    <VisibilityOutlinedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
