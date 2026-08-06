import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { KpiCard } from "./KpiCard";
import { ProjectListCard } from "./ProjectListCard";
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
        <KpiCard
          label={t("dashboard.technician.kpis.workOrders")}
          value={data.projects.length}
          tone={TONE.success}
        />
      </Box>

      {/* One list of the assigned work, earliest planned first. Date buckets
          (overdue/today/upcoming) were tried and dropped: they labelled
          never-closed werkbonnen as "late", and work could fall between them. */}
      <ProjectListCard
        title={t("dashboard.technician.workTitle")}
        rows={data.projects}
        empty={t("dashboard.technician.noWorkOrders")}
      />
    </>
  );
}
