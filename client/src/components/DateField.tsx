import TextField, { type TextFieldProps } from "@mui/material/TextField";

// A native date input whose WHOLE surface opens the calendar.
//
// A bare `type="date"` splits its click area: the dd-mm-jjjj segments put a
// caret in the field (type it by hand), and only the ~16px icon at the far
// right opens the picker. Clicking the obvious place — the middle, where the
// date is — therefore looks like "the calendar doesn't open, I can only type".
// showPicker() on click/focus makes any part of the field open it, while
// leaving keyboard entry into the segments working as before.
//
// showPicker() must be called from a user gesture (click/focus qualify) and is
// optional-chained, so a browser without it just keeps the old icon-only
// behaviour rather than throwing.
export function DateField(props: TextFieldProps) {
  const { slotProps, ...rest } = props;

  const openPicker = (e: React.SyntheticEvent<HTMLInputElement>) => {
    // showPicker() isn't in every TS DOM lib version yet; the cast is local
    // rather than a global augmentation.
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
    el.showPicker?.();
  };

  return (
    <TextField
      type="date"
      {...rest}
      slotProps={{
        ...slotProps,
        // A date input always shows its dd-mm-jjjj mask, so the label must sit
        // above it or the two collide.
        inputLabel: { shrink: true, ...slotProps?.inputLabel },
        htmlInput: {
          ...(slotProps?.htmlInput as Record<string, unknown> | undefined),
          onClick: openPicker,
          onFocus: openPicker,
        },
      }}
    />
  );
}
