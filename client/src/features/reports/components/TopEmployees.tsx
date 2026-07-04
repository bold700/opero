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
import { HAIRLINE, LAVENDER } from "../../../theme/tokens";
import type { ReportsData } from "../api";
import { initials, formatHours } from "../constants";

type TopEmployee = ReportsData["topEmployees"][number];

// Top technicians ranking: a table on desktop (md+), a stack of rows on mobile
// (xs–sm). Both live inside this section card, so we render the two variants
// inline (rather than ResponsiveList, which wraps in its own card) to keep the
// desktop table flat and unchanged.
export function TopEmployees({ employees }: { employees: ReportsData["topEmployees"] }) {
  const { t, i18n } = useTranslation();

  const identity = (emp: TopEmployee) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: LAVENDER, color: "primary.main", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
        {initials(emp.name)}
      </Avatar>
      <Typography sx={{ fontWeight: 600 }} noWrap>{emp.name}</Typography>
    </Box>
  );

  return (
    <Card sx={{ width: "100%", minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {t("reports.topTechnicians.title")}
      </Typography>

      {employees.length === 0 ? (
        <Typography sx={{ color: "text.secondary", textAlign: "center", py: 3 }}>
          {t("reports.topTechnicians.empty")}
        </Typography>
      ) : (
        <>
          {/* Desktop: table */}
          <Table sx={{ display: { xs: "none", md: "table" }, "& th, & td": { borderColor: HAIRLINE } }}>
            <TableHead>
              <TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 600, fontSize: 13 } }}>
                <TableCell>{t("reports.topTechnicians.name")}</TableCell>
                <TableCell align="right">{t("reports.topTechnicians.workOrders")}</TableCell>
                <TableCell align="right">{t("reports.topTechnicians.hours")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id} sx={{ "&:last-child td": { border: 0 } }}>
                  <TableCell>{identity(emp)}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{emp.workOrderCount}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{formatHours(emp.hours, i18n.language)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Mobile: stacked rows */}
          <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column" }}>
            {employees.map((emp, i) => (
              <Box
                key={emp.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  py: 1.25,
                  borderTop: i === 0 ? "none" : `1px solid ${HAIRLINE}`,
                }}
              >
                {identity(emp)}
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: "text.secondary", fontSize: 13, flexShrink: 0 }}>
                  <span>{t("reports.topTechnicians.workOrders")}: {emp.workOrderCount}</span>
                  <span>{t("reports.topTechnicians.hours")}: {formatHours(emp.hours, i18n.language)}</span>
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Card>
  );
}
