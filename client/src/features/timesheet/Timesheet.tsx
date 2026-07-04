import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { PageLayout } from "../../components/PageLayout";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../lib/api/useApi";
import i18n from "../../i18n";
import { PeriodPicker } from "../reports/components/PeriodPicker";
import { monthPeriod, type Period } from "../reports/constants";
import { getTimesheet, type Timesheet as TimesheetData } from "./api";
import { TimesheetTable } from "./components/TimesheetTable";

// The logged-in user's own timesheet (hours logged per work order). Per the
// permission matrix this is the technician's "Reports = own timesheet" access.
// Admins may also open it — it shows THEIR own hours (or an empty state if their
// login isn't linked to an employee record).
export function Timesheet() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const lang = i18n.language;

  const [period, setPeriod] = useState<Period>(() => monthPeriod());

  // A login with no linked employee (e.g. an admin who isn't also staff) has no
  // timesheet — show a friendly note instead of calling the API with a bad id.
  const noEmployee = !employeeId;

  const { data, loading, error } = useApi<TimesheetData>(
    () =>
      employeeId
        ? getTimesheet(employeeId, period.from, period.to)
        : Promise.resolve({ employeeId: "", totalHours: 0, entries: [] }),
    // Refetch when the period changes.
    [employeeId, period.from, period.to],
  );

  const body = useMemo(() => {
    if (noEmployee) {
      return <Alert severity="info">{t("timesheet.noEmployee")}</Alert>;
    }
    if (loading) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      );
    }
    if (error) return <Alert severity="error">{error}</Alert>;
    return (
      <TimesheetTable
        entries={data?.entries ?? []}
        totalHours={data?.totalHours ?? 0}
        lang={lang}
      />
    );
  }, [noEmployee, loading, error, data, lang, t]);

  return (
    <PageLayout
      title={t("timesheet.title")}
      actions={
        noEmployee ? undefined : (
          // Full-width on mobile so the period navigator spreads across the row
          // instead of being squeezed; unchanged inline width on desktop.
          <Box
            sx={{
              width: { xs: "100%", sm: "auto" },
              display: "flex",
              justifyContent: { xs: "space-between", sm: "flex-start" },
            }}
          >
            <PeriodPicker period={period} onChange={setPeriod} />
          </Box>
        )
      }
    >
      {body}
    </PageLayout>
  );
}
