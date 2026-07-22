import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import FilterListIcon from "@mui/icons-material/FilterList";
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
// Collapsed by default so the common case (look at Open, scan the list) stays
// as quiet as it was; the toggle shows a count badge when filters are active,
// so an active filter can never be invisible.
export function WorkOrderFilterBar({
  open,
  onToggle,
  filters,
  onChange,
  options,
  loading,
}: {
  open: boolean;
  onToggle: () => void;
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

  const activeCount = Object.values(filters).filter(Boolean).length;

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Button
          size="small"
          startIcon={<FilterListIcon />}
          onClick={onToggle}
          variant={open ? "contained" : "outlined"}
          disableElevation
        >
          {t("workOrders.filterBar.toggle")}
        </Button>
        {activeCount > 0 ? (
          <>
            <Chip size="small" color="primary" label={activeCount} />
            <Button size="small" onClick={() => onChange({})}>
              {t("workOrders.filterBar.clear")}
            </Button>
          </>
        ) : null}
      </Box>

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
          <TextField
            type="date"
            size="small"
            label={t("workOrders.filterBar.dateFrom")}
            value={filters.dateFrom ?? ""}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            type="date"
            size="small"
            label={t("workOrders.filterBar.dateTo")}
            value={filters.dateTo ?? ""}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
        </Box>
      </Collapse>
    </Box>
  );
}
