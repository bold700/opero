import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useTranslation } from "react-i18next";
import { LAVENDER, SPACING } from "../../../theme/tokens";
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

// One row of filter pills, each carrying its own count (WhatsApp-style), so the
// filters and the summary counts are a single control instead of two rows.
export function CustomerFilterBar({ active, counts, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", gap: SPACING.itemGap, flexWrap: "wrap" }}>
      {FILTERS.map((f) => {
        const isActive = f === active;
        const count = countFor(f, counts);
        return (
          <Chip
            key={f}
            onClick={() => onChange(f)}
            variant={isActive ? "filled" : "outlined"}
            label={
              <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75 }}>
                {t(`customers.filters.${f}`)}
                <Box
                  component="span"
                  sx={{ fontWeight: 600, opacity: isActive ? 0.9 : 0.6, fontVariantNumeric: "tabular-nums" }}
                >
                  {count}
                </Box>
              </Box>
            }
            sx={
              isActive
                ? { bgcolor: LAVENDER, color: "primary.main", fontWeight: 600 }
                : { color: "text.secondary" }
            }
          />
        );
      })}
    </Box>
  );
}
