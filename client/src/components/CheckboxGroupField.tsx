import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import { HAIRLINE, RADIUS, TAP_TARGET } from "../theme/tokens";

// A multi-select rendered as an INLINE checkbox list — no popover, no portal.
//
// Why this exists: a MUI `<Select multiple>` inside a mobile bottom sheet is
// broken. Its menu is portaled into the sheet (it has to be — vaul blocks
// pointer events on anything portaled to document.body outside its content),
// but the sheet sets `overflow: hidden`, so the popover is CLIPPED, and its
// viewport-anchored placement math resolves against the sheet instead of the
// screen. The result is a flat unelevated panel covering the form.
//
// `SelectField` dodges this by falling back to the native <select> on mobile.
// A multi-select has no usable native equivalent (`<select multiple>` is a
// desktop control; on iOS it degrades to an unlabelled scroll box), so for a
// SHORT, FIXED option list the fix is to not use a popover at all. Inline
// checkboxes are also fewer taps: no open → tap → tap → dismiss cycle.
//
// For a LONG or searchable list prefer `<Autocomplete multiple>` with a bounded
// `paper` maxHeight (see the monteurs picker in ProjectInfoPanel) — an inline
// list of 40 employees would bury the rest of the form.
export type CheckboxOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export function CheckboxGroupField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  helperText,
  columns = 1,
}: {
  label: ReactNode;
  value: readonly T[];
  onChange: (next: T[]) => void;
  options: readonly CheckboxOption<T>[];
  disabled?: boolean;
  helperText?: ReactNode;
  /** Lay the checkboxes out in N columns — 2 keeps a 6+ item list compact. */
  columns?: 1 | 2;
}) {
  const toggle = (v: T) => {
    // Preserve the OPTION order rather than click order, so the chips/summary a
    // caller renders elsewhere stay stable across edits.
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(options.map((o) => o.value).filter((o) => next.includes(o)));
  };

  return (
    <FormControl disabled={disabled} component="fieldset" variant="standard" sx={{ m: 0 }}>
      <FormLabel
        component="legend"
        sx={{ typography: "caption", mb: 0.5, "&.Mui-focused": { color: "text.secondary" } }}
      >
        {label}
      </FormLabel>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          border: `1px solid ${HAIRLINE}`,
          borderRadius: `${RADIUS.control}px`,
          px: 1.5,
          py: 0.5,
        }}
      >
        {options.map((o) => (
          <FormControlLabel
            key={o.value}
            control={
              <Checkbox
                size="small"
                checked={value.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
            }
            label={o.label}
            // Full-width rows with a comfortable tap target: the whole label is
            // the hit area, not just the 20px box.
            sx={{ minHeight: TAP_TARGET, mx: 0, "& .MuiFormControlLabel-label": { typography: "body2" } }}
          />
        ))}
      </Box>
      {helperText ? <FormHelperText sx={{ mx: 0 }}>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
