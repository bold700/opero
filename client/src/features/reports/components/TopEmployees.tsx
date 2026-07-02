import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { LAVENDER } from "../../../theme/tokens";
import type { ReportsData } from "../api";
import { initials, formatHours } from "../constants";

// Top technicians ranking table — work orders + hours in the selected period.
export function TopEmployees({ employees }: { employees: ReportsData["topEmployees"] }) {
  const { t, i18n } = useTranslation();
  return (
    <Card sx={{ width: "100%", minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t("reports.topTechnicians.title")}
      </Typography>
      <Table sx={{ "& th, & td": { borderColor: "#F0EDF1" } }}>
        <TableHead>
          <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
            <TableCell>{t("reports.topTechnicians.name")}</TableCell>
            <TableCell align="right">{t("reports.topTechnicians.workOrders")}</TableCell>
            <TableCell align="right">{t("reports.topTechnicians.hours")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} sx={{ color: "text.secondary", textAlign: "center", py: 3 }}>
                {t("reports.topTechnicians.empty")}
              </TableCell>
            </TableRow>
          ) : (
            employees.map((emp) => (
              <TableRow key={emp.id} sx={{ "&:last-child td": { border: 0 } }}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: LAVENDER, color: "primary.main", fontSize: 13, fontWeight: 700 }}>
                      {initials(emp.name)}
                    </Avatar>
                    <Typography sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ color: "text.secondary" }}>{emp.workOrderCount}</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary" }}>{formatHours(emp.hours, i18n.language)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
