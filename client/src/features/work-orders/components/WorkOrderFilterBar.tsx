import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import { DateField } from "../../../components/DateField";
import { SelectField, type SelectOption } from "../../../components/SelectField";
import type { FilterOption, WorkOrderFilters } from "../api";

// The narrowing filters for the work-order overview, above the table.
//
// Status chips + a text search were the only way to find a werkbon, which is
// fine while a job is live and useless months later ("improve the filters in
// the work order overview, so work orders can easily be found afterwards" —
// WOB Isolatie, 17-07-2026). This adds customer, monteur, type werk (the
// material on the lines, as the column shows it) and a planned-date range.
//
// This is the PANEL only. Its trigger lives in WorkOrderFilterToggle, which
// rides on the status-chip row (far right) so the filters cost no vertical
// space while closed — the common case is "look at Open, scan the list".
// Shown/hidden with a plain conditional like every other section in the app:
// the animated Collapse it used to be left a stray gap row while closed and
// mis-sized against the table on the client's machine.
export function WorkOrderFilterBar({
  open,
  filters,
  onChange,
  options,
  loading,
}: {
  open: boolean;
  filters: WorkOrderFilters;
  onChange: (next: WorkOrderFilters) => void;
  options: {
    customers: FilterOption[];
    assignees: FilterOption[];
    materials: FilterOption[];
  } | null;
  loading: boolean;
}) {
  const { t } = useTranslation();

  const set = (patch: Partial<WorkOrderFilters>) => {
    const next = { ...filters, ...patch };
    // Drop empty values so they never reach the query string.
    for (const k of Object.keys(next) as (keyof WorkOrderFilters)[]) {
      if (!next[k]) delete next[k];
    }
    onChange(next);
  };

  const toOptions = (rows: FilterOption[] | undefined): SelectOption[] => [
    { value: "", label: t("workOrders.filterBar.any") },
    ...(rows ?? []).map((r) => ({ value: r.id, label: r.name })),
  ];

  if (!open) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        // One column on a phone, two on a tablet, all five in one row on a
        // desktop — the monteur's phone is a first-class target for this screen.
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(5, 1fr)" },
      }}
    >
        <SelectField
          label={t("workOrders.filterBar.customer")}
          value={filters.customerId ?? ""}
          onChange={(v) => set({ customerId: v || undefined })}
          options={toOptions(options?.customers)}
          disabled={loading}
          fullWidth
        />
        <SelectField
          label={t("workOrders.filterBar.assignee")}
          value={filters.assigneeId ?? ""}
          onChange={(v) => set({ assigneeId: v || undefined })}
          options={toOptions(options?.assignees)}
          disabled={loading}
          fullWidth
        />
        <SelectField
          label={t("workOrders.filterBar.workType")}
          value={filters.materialId ?? ""}
          onChange={(v) => set({ materialId: v || undefined })}
          options={toOptions(options?.materials)}
          disabled={loading}
          fullWidth
        />
        <DateField
          size="small"
          label={t("workOrders.filterBar.dateFrom")}
          value={filters.dateFrom ?? ""}
          onChange={(e) => set({ dateFrom: e.target.value || undefined })}
          fullWidth
        />
        <DateField
          size="small"
          label={t("workOrders.filterBar.dateTo")}
          value={filters.dateTo ?? ""}
          onChange={(e) => set({ dateTo: e.target.value || undefined })}
          fullWidth
        />
    </Box>
  );
}
