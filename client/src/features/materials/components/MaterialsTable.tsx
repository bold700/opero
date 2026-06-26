import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Card } from "../../../components/Card";
import { StatusBadge } from "../../../components/StatusBadge";
import type { MaterialRow } from "../api";
import { STATUS, swatchColor } from "../constants";

// The materials table card: columns + real rows.
export function MaterialsTable({ rows }: { rows: MaterialRow[] }) {
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
            <TableCell>{t("materials.columns.name")}</TableCell>
            <TableCell>{t("materials.columns.category")}</TableCell>
            <TableCell>{t("materials.columns.unit")}</TableCell>
            <TableCell>{t("materials.columns.stock")}</TableCell>
            <TableCell>{t("materials.columns.minStock")}</TableCell>
            <TableCell>{t("materials.columns.status")}</TableCell>
            <TableCell align="right">{t("materials.columns.action")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                {t("materials.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: swatchColor(r.name), flexShrink: 0 }} />
                    <Typography sx={{ fontWeight: 600 }}>{r.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.category}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.unit}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.stock}</TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{r.minStock}</TableCell>
                <TableCell>
                  <StatusBadge label={t(STATUS[r.status].labelKey)} tone={STATUS[r.status].tone} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" aria-label={t("materials.viewAction")}>
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
