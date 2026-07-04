import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Card } from "../../../components/Card";
import { ResponsiveList } from "../../../components/ResponsiveList";
import { formatDate, formatHours } from "../../reports/constants";
import type { TimesheetEntry } from "../api";

// The technician's logged hours for the selected period, grouped by day (newest
// first), with a total row. Read-only — this is their own timesheet. Renders as a
// dense table on desktop (md+) and a stack of cards on mobile (xs–sm).
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <ResponsiveList
        items={sorted}
        keyOf={(e) => `${e.projectId}-${e.day ?? "na"}-${sorted.indexOf(e)}`}
        empty={t("timesheet.empty")}
        columns={[
          {
            header: t("timesheet.table.day"),
            cell: (e) => (
              <Box sx={{ color: "text.secondary" }}>{e.day ? formatDate(e.day) : "—"}</Box>
            ),
          },
          {
            header: t("timesheet.table.project"),
            cell: (e) => <Box sx={{ fontWeight: 600 }}>{e.projectNumber}</Box>,
          },
          {
            header: t("timesheet.table.hours"),
            align: "right",
            cell: (e) => (
              <Box sx={{ fontVariantNumeric: "tabular-nums" }}>{formatHours(e.hours, lang)}</Box>
            ),
          },
        ]}
        renderCard={(e) => (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            {/* Left: work order (primary) + day (secondary) */}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }}>{e.projectNumber}</Typography>
              <Typography variant="body2" color="text.secondary">
                {e.day ? formatDate(e.day) : "—"}
              </Typography>
            </Box>
            {/* Right: hours */}
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {formatHours(e.hours, lang)}
            </Typography>
          </Box>
        )}
      />

      {/* Total — a footer card so it shows in both the table and card layouts. */}
      {sorted.length > 0 ? (
        <Card
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 3,
            py: 2,
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>{t("timesheet.total")}</Typography>
          <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatHours(totalHours, lang)}
          </Typography>
        </Card>
      ) : null}
    </Box>
  );
}
