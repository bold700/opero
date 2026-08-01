import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "react-i18next";
import { Card } from "../../../components/Card";
import { KpiCard } from "./KpiCard";
import { TONE } from "../constants";
import type { ForemanDashboard, TechnicianDashboard } from "../api";

export function TechnicianView({ data }: { data: TechnicianDashboard | ForemanDashboard }) {
  const { t } = useTranslation();
  // The foreman sees this same money-free view org-wide, so his first KPI
  // counts ALL projects, not "assigned" ones — different label, same number
  // slot (the backend already scopes the count per role).
  const projectsLabel =
    data.role === "foreman"
      ? t("dashboard.foreman.kpis.allProjects")
      : t("dashboard.technician.kpis.assignedProjects");
  return (
    <>
      <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
        <KpiCard label={projectsLabel} value={data.assignedProjectCount} tone={TONE.primary} />
        <KpiCard label={t("dashboard.technician.kpis.openTasks")} value={data.openTaskCount} tone={TONE.info} />
        <KpiCard label={t("dashboard.technician.kpis.today")} value={data.todayProjects.length} tone={TONE.success} />
      </Box>

      <Card sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {t("dashboard.technician.todayTitle")}
        </Typography>
        {data.todayProjects.length === 0 ? (
          <Typography color="text.secondary">{t("dashboard.technician.noWorkOrders")}</Typography>
        ) : (
          data.todayProjects.map((p, i, arr) => (
            <Box key={p.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{p.customerName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {p.address}, {p.city}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.technician.taskCount", { count: p.openTaskCount })}
                </Typography>
                <ChevronRightIcon sx={{ color: "text.disabled", fontSize: 20 }} />
              </Box>
              {i < arr.length - 1 ? <Divider /> : null}
            </Box>
          ))
        )}
      </Card>
    </>
  );
}
