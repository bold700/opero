import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { projectStatusIds } from "@opero/shared";
import { FilterSelect } from "../../../components/FilterSelect";
import { getWorkTypes, type WorkTypeOption } from "../../work-order-detail/api";

// Filters above the projects list: status + work type. "" means "all" for both
// (no filter param sent). Work types load once — the org's list is short.
export function ProjectsFilterBar({
  status,
  workTypeId,
  onStatusChange,
  onWorkTypeChange,
}: {
  status: string;
  workTypeId: string;
  onStatusChange: (value: string) => void;
  onWorkTypeChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [workTypes, setWorkTypes] = useState<WorkTypeOption[]>([]);

  useEffect(() => {
    getWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
  }, []);

  return (
    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
      <FilterSelect
        value={status}
        onChange={onStatusChange}
        ariaLabel={t("projects.filters.statusLabel")}
        options={[
          { value: "", label: t("projects.filters.allStatuses") },
          ...projectStatusIds.map((s) => ({ value: s, label: t(`projects.status.${s}`) })),
        ]}
      />
      <FilterSelect
        value={workTypeId}
        onChange={onWorkTypeChange}
        ariaLabel={t("projects.filters.workTypeLabel")}
        options={[
          { value: "", label: t("projects.filters.allWorkTypes") },
          ...workTypes.map((w) => ({ value: w.id, label: w.name })),
        ]}
      />
    </Box>
  );
}
