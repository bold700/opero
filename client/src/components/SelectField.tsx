import type { ReactNode } from "react";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

// A single-select field that uses the platform-standard control:
//  - Desktop: the MUI dropdown menu (styled MenuItems).
//  - Mobile:  the NATIVE <select> — the OS picker every phone user knows. It's a
//             real browser control, so it can never be blocked by an overlay
//             (unlike the JS-portaled MUI menu, which a bottom-sheet's focus trap
//             makes unclickable).
//
// Options-driven so both platforms render the right element from one source.
export type SelectOption = {
  value: string;
  label: ReactNode;
  /** Optional per-item emphasis (desktop only; native <option> can't be styled). */
  emphasize?: boolean;
};

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  size = "small",
  fullWidth,
  sx,
  helperText,
  error,
  required,
  autoFocus,
  nativeBelow = "sm",
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  size?: "small" | "medium";
  fullWidth?: boolean;
  sx?: object;
  helperText?: ReactNode;
  error?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  /**
   * Below which breakpoint to use the native picker. Defaults to "sm" (phones).
   * Raise it to match a bottom sheet's own breakpoint: inside a sheet the MUI
   * menu is clipped by the sheet's `overflow: hidden`, so anywhere the sheet
   * renders, this must be native too.
   */
  nativeBelow?: "sm" | "md" | "lg";
}) {
  const theme = useTheme();
  const nativeSelect = useMediaQuery(theme.breakpoints.down(nativeBelow));

  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      size={size}
      fullWidth={fullWidth}
      sx={sx}
      helperText={helperText}
      error={error}
      required={required}
      autoFocus={autoFocus}
      slotProps={{
        // Native picker on mobile (OS-standard, never blocked); MUI menu on desktop.
        select: { native: nativeSelect },
        // A native select with a label needs the label kept shrunk so it doesn't
        // overlap the value.
        inputLabel: nativeSelect ? { shrink: true } : undefined,
      }}
    >
      {nativeSelect
        ? options.map((o) => (
            // Native <option>: text only (browsers ignore rich styling here).
            <option key={o.value} value={o.value}>
              {typeof o.label === "string" ? o.label : String(o.label)}
            </option>
          ))
        : options.map((o) => (
            <MenuItem
              key={o.value}
              value={o.value}
              sx={o.emphasize ? { color: "primary.main", fontWeight: 600 } : undefined}
            >
              {o.label}
            </MenuItem>
          ))}
    </TextField>
  );
}
