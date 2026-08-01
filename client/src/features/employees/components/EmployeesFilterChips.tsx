import { useTranslation } from "react-i18next";
import { FilterSelect } from "../../../components/FilterSelect";
import { FILTERS, FILTER_LABEL_KEY, type EmployeeFilter } from "../constants";
import type { EmployeeCounts } from "../api";

// "all" shows the whole-set total; every other filter key is also a key on
// EmployeeCounts, so its count comes straight off the same object.
function countFor(filter: EmployeeFilter, counts: EmployeeCounts): number {
  return filter === "all" ? counts.total : counts[filter];
}

export function EmployeesFilterChips({
  value,
  counts,
  onChange,
}: {
  value: EmployeeFilter;
  counts: EmployeeCounts;
  onChange: (f: EmployeeFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <FilterSelect
      value={value}
      onChange={(v) => onChange(v as EmployeeFilter)}
      ariaLabel={t("employees.filters.label")}
      options={FILTERS.map((f) => ({
        value: f,
        label: t(FILTER_LABEL_KEY[f]),
        count: countFor(f, counts),
      }))}
    />
  );
}
