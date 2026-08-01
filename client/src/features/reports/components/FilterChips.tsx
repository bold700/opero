import { useTranslation } from "react-i18next";
import { FilterSelect } from "../../../components/FilterSelect";
import { FILTER_CHIPS } from "../constants";
import type { ReportFilter } from "../api";

// Focus filter: "Alle" shows everything; picking one focuses the breakdown
// below the KPIs on that dimension (work orders / hours / materials).
export function FilterChips({
  value,
  onChange,
}: {
  value: ReportFilter;
  onChange: (f: ReportFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <FilterSelect
      value={value}
      onChange={(v) => onChange(v as ReportFilter)}
      ariaLabel={t("reports.filters.label")}
      options={FILTER_CHIPS.map((f) => ({ value: f, label: t(`reports.filters.${f}`) }))}
    />
  );
}
