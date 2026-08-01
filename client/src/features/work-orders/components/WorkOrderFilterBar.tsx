import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import { DateField } from "../../../components/DateField";
import { SelectField, type SelectOption } from "../../../components/SelectField";
import type { FilterOption, WorkOrderFilters } from "../api";

// The narrowing filters for the work-order overview, above the table.
//
// Status chips + a text search were the only way to find a werkbon, which is
// fine while a job is live and useless months later ("improve the filters in
// the work order overview, so work orders can easily be found afterwards" —
// WOB Isolatie, 17-07-2026). This adds customer, monteur, work type and a
// planned-date range.
//
// This is the collapsible PANEL only. Its trigger lives in
// WorkOrderFilterToggle, which rides on the status-chip row (far right) so the
// filters cost no vertical space while collapsed — the common case is "look at
// Open, scan the list", and the panel used to push the table down by a whole row.
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
    workTypes: FilterOption[];
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

  return (
    <Collapse in={open} unmountOnExit>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          // One column on a phone, up to three on a desktop — the monteur's
          // phone is a first-class target for this screen.
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
          pt: 0.5,
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
          value={filters.workTypeId ?? ""}
          onChange={(v) => set({ workTypeId: v || undefined })}
          options={toOptions(options?.workTypes)}
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
    </Collapse>
  );
}
