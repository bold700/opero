import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { FILTER_CHIPS } from "../constants";
import type { ReportFilter } from "../api";

// Focus chips: "Alle" shows everything; picking one focuses the breakdown below
// the KPIs on that dimension (work orders / hours / materials).
export function FilterChips({
  value,
  onChange,
}: {
  value: ReportFilter;
  onChange: (f: ReportFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      {FILTER_CHIPS.map((f) => (
        <Chip
          key={f}
          label={t(`reports.filters.${f}`)}
          onClick={() => onChange(f)}
          color={value === f ? "primary" : "default"}
          variant={value === f ? "filled" : "outlined"}
          sx={{ fontWeight: 500 }}
        />
      ))}
    </Box>
  );
}
