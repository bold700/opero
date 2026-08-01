import { useTranslation } from "react-i18next";
import { FilterSelect } from "../../../components/FilterSelect";
import { FILTERS, type CustomerFilter } from "../constants";
import type { CustomerCounts } from "../api";

type Props = {
  active: CustomerFilter;
  counts: CustomerCounts;
  onChange: (filter: CustomerFilter) => void;
};

// The "all" filter shows the whole-set total; the other two map to a count of
// the same name.
function countFor(filter: CustomerFilter, counts: CustomerCounts): number {
  return filter === "all" ? counts.total : counts[filter];
}

export function CustomerFilterBar({ active, counts, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <FilterSelect
      value={active}
      onChange={(v) => onChange(v as CustomerFilter)}
      ariaLabel={t("customers.filters.label")}
      options={FILTERS.map((f) => ({
        value: f,
        label: t(`customers.filters.${f}`),
        count: countFor(f, counts),
      }))}
    />
  );
}
