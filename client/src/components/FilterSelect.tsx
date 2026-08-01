import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";

export type FilterSelectOption = {
  value: string;
  label: string;
  // Optional trailing count, rendered as "Business (12)" — parens read as a
  // clearly separate count rather than running into the label.
  count?: number;
};

// The single filter control used across list pages (employees, customers,
// reports, work orders, materials suppliers) instead of a row of Chip pills —
// a chip row wraps to a second line once there are more than ~3-4 options on
// a phone; a Select never does, at any screen size or option count.
export function FilterSelect({
  value,
  options,
  onChange,
  ariaLabel,
  minWidth = 160,
}: {
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  minWidth?: number;
}) {
  return (
    <Select
      value={value}
      onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
      size="small"
      aria-label={ariaLabel}
      // Some callers use "" as a real option value (e.g. "All suppliers"),
      // and MUI's Select renders an empty-string value as blank unless told
      // there IS a selection — displayEmpty makes it render that option's
      // label instead of looking unselected.
      displayEmpty
      sx={{
        bgcolor: "background.paper",
        minWidth,
        // Size to the content, never to the container. The page's content area
        // is a COLUMN flex, so a child stretches full-width on the cross axis by
        // default — which made this read as a full-page-wide input rather than a
        // filter control.
        //
        // `width: fit-content` (not alignSelf) is what opts out of that stretch:
        // it leaves the parent's own alignItems intact, which matters where this
        // sits in a ROW next to another control (work orders: the Filters
        // toggle, alignItems "center") and alignSelf would top-align it.
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.count === undefined ? (
            o.label
          ) : (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}>
              {o.label}
              <Box
                component="span"
                sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
              >
                ({o.count})
              </Box>
            </Box>
          )}
        </MenuItem>
      ))}
    </Select>
  );
}
