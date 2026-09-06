import { useTranslation } from "react-i18next";
import { projectStatusIds } from "@opero/shared";
import { FilterSelect } from "../../../components/FilterSelect";

// Status filter above the projects list. "" means all (no filter param sent).
export function ProjectsFilterBar({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <FilterSelect
      value={status}
      onChange={onStatusChange}
      ariaLabel={t("projects.filters.statusLabel")}
      options={[
        { value: "", label: t("projects.filters.allStatuses") },
        ...projectStatusIds.map((s) => ({ value: s, label: t(`projects.status.${s}`) })),
      ]}
    />
  );
}
