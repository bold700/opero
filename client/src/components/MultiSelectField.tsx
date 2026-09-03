import type { ReactNode } from "react";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { SelectOption } from "./SelectField";

// The multi-select twin of SelectField: same TextField-select look, same
// platform split (MUI menu on desktop, NATIVE <select multiple> on phones —
// see SelectField for why). The closed field shows the chosen labels joined.
export function MultiSelectField({
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
  nativeBelow = "sm",
}: {
  label: ReactNode;
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  disabled?: boolean;
  size?: "small" | "medium";
  fullWidth?: boolean;
  sx?: object;
  helperText?: ReactNode;
  error?: boolean;
  nativeBelow?: "sm" | "md" | "lg";
}) {
  const theme = useTheme();
  const nativeSelect = useMediaQuery(theme.breakpoints.down(nativeBelow));
  const labelOf = (v: string) => {
    const o = options.find((x) => x.value === v);
    return o ? (typeof o.label === "string" ? o.label : String(o.label)) : v;
  };

  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(e) => {
        const raw = e.target.value as unknown;
        if (Array.isArray(raw)) {
          onChange(raw as string[]);
          return;
        }
        // Native <select multiple> reports via selectedOptions, not value.
        const el = e.target as unknown as HTMLSelectElement;
        onChange(Array.from(el.selectedOptions ?? [], (o) => o.value));
      }}
      disabled={disabled}
      size={size}
      fullWidth={fullWidth}
      sx={sx}
      helperText={helperText}
      error={error}
      slotProps={{
        select: {
          multiple: true,
          native: nativeSelect,
          renderValue: nativeSelect
            ? undefined
            : (selected) => (selected as string[]).map(labelOf).join(", "),
        },
        inputLabel: nativeSelect ? { shrink: true } : undefined,
      }}
    >
      {nativeSelect
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {typeof o.label === "string" ? o.label : String(o.label)}
            </option>
          ))
        : options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              <Checkbox size="small" checked={value.includes(o.value)} sx={{ p: 0.5, mr: 1 }} />
              {o.label}
            </MenuItem>
          ))}
    </TextField>
  );
}
