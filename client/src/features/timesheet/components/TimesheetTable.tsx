import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { Card } from "../../../components/Card";
import { formatDate, formatHours } from "../../reports/constants";
import type { TimesheetEntry } from "../api";

// The technician's logged hours for the selected period, grouped by day (newest
// first), with a total row. Read-only — this is their own timesheet.
export function TimesheetTable({
  entries,
  totalHours,
  lang,
}: {
  entries: TimesheetEntry[];
  totalHours: number;
  lang: string;
}) {
  const { t } = useTranslation();

  // Sort by day descending; entries without a day sink to the bottom.
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (!a.day) return 1;
        if (!b.day) return -1;
        return b.day.localeCompare(a.day);
      }),
    [entries],
  );

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
            <TableCell>{t("timesheet.table.day")}</TableCell>
            <TableCell>{t("timesheet.table.project")}</TableCell>
            <TableCell align="right">{t("timesheet.table.hours")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                {t("timesheet.empty")}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((e, i) => (
              <TableRow key={`${e.projectId}-${e.day ?? "na"}-${i}`} hover>
                <TableCell sx={{ color: "text.secondary" }}>
                  {e.day ? formatDate(e.day) : "—"}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{e.projectNumber}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatHours(e.hours, lang)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {sorted.length > 0 ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 3,
            py: 2,
            borderTop: "1px solid #F0EDF1",
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>{t("timesheet.total")}</Typography>
          <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatHours(totalHours, lang)}
          </Typography>
        </Box>
      ) : null}
    </Card>
  );
}
