import { useCallback, useEffect, useRef, useState } from "react";
import type { TextFieldProps } from "@mui/material/TextField";
import { DateField } from "./DateField";

// How long to wait after the last change before saving. Long enough that
// stepping through months/years collapses into a single save; short enough that
// picking a day feels instant.
const COMMIT_DELAY_MS = 500;

// Reject half-typed years (typing "2026" fires change at 0002 → 0020 → 0202)
// so an intermediate value never reaches the server.
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

function isCommittable(value: string): boolean {
  if (value === "") return true; // clearing the field is a valid edit
  const year = Number(value.slice(0, 4));
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/**
 * A date field that saves itself, without ever disturbing an open picker.
 *
 * THE INVARIANT: while the input has focus, nothing here touches it — no
 * remount, no programmatic value write, no `disabled` flip. Each of those makes
 * the browser close the native calendar, which is what made month/year arrows
 * feel like "it closed / it saved on me". Server state is therefore only synced
 * into the field while it is NOT focused (see the effect below), and the field
 * is uncontrolled with a caller-supplied stable key.
 *
 * COMMIT TIMING:
 *   - change → debounced save. Stepping through months (which fires a change
 *     per step in some browsers) just restarts the timer, so nothing is saved
 *     mid-navigation. Picking a day closes the picker itself, and the save
 *     lands ~0.5s later.
 *   - blur / Enter → save now (cancels the debounce), for typed input.
 * A ref holds the last committed value so change-then-blur, and the server
 * echoing the value back, don't re-send it.
 */
export function AutosaveDateField({
  value,
  onCommit,
  ...rest
}: {
  /** Server value. Written into the field only while it isn't focused. */
  value: string;
  /** Called with the new value ("" = cleared) when a save is due. */
  onCommit: (value: string) => void;
} & Omit<TextFieldProps, "value" | "onChange" | "onBlur" | "defaultValue">) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the server last confirmed / we last sent — the dedupe baseline.
  const committed = useRef(value);
  // Mirrors the server value into the input, but only when it's safe to touch.
  const [displayValue, setDisplayValue] = useState(value);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const commit = useCallback(
    (next: string) => {
      cancel();
      if (next === committed.current) return;
      committed.current = next;
      onCommit(next);
    },
    [cancel, onCommit],
  );

  // Adopt the server value — but never while the user is in the field, because
  // re-rendering it with a new value closes an open picker.
  useEffect(() => {
    committed.current = value;
    const focused = document.activeElement === inputRef.current;
    if (!focused) setDisplayValue(value);
  }, [value]);

  useEffect(() => cancel, [cancel]);

  return (
    <DateField
      {...rest}
      inputRef={inputRef}
      value={displayValue}
      onChange={(e) => {
        const next = e.target.value;
        setDisplayValue(next);
        cancel();
        if (!isCommittable(next)) return;
        timer.current = setTimeout(() => commit(next), COMMIT_DELAY_MS);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
      }}
    />
  );
}
