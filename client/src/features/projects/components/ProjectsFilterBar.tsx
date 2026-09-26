import { useTranslation } from "react-i18next";
import { projectStatusIds } from "@opero/shared";
import { FilterSelect } from "../../../components/FilterSelect";
import Box from "@mui/material/Box";
import { SPACING } from "../../../theme/tokens";
import type { ProjectVisibility } from "../api";

// Status filter above the projects list. "" means all (no filter param sent).
export function ProjectsFilterBar({
  status,
  onStatusChange,
  visibility,
  onVisibilityChange,
}: {
  status: string;
  onStatusChange: (value: string) => void;
  visibility: ProjectVisibility;
  onVisibilityChange: (value: ProjectVisibility) => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: SPACING.itemGap }}>
      <FilterSelect
        value={visibility}
        onChange={(value) => onVisibilityChange(value as ProjectVisibility)}
        ariaLabel={t("projects.filters.visibilityLabel")}
        options={[
          { value: "active", label: t("projects.filters.active") },
          { value: "archived", label: t("projects.filters.history") },
          { value: "all", label: t("projects.filters.allProjects") },
        ]}
      />
      <FilterSelect
        value={status}
        onChange={onStatusChange}
        ariaLabel={t("projects.filters.statusLabel")}
        options={[
          { value: "", label: t("projects.filters.allStatuses") },
          ...projectStatusIds.map((s) => ({ value: s, label: t(`projects.status.${s}`) })),
        ]}
      />
    </Box>
  );
}
