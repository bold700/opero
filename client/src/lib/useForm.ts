import { useCallback, useMemo, useState } from "react";
import { firstError, type Validator } from "./validation";

// Minimal form helper: holds values, per-field validators, touched state, and
// derives errors. No library — plain useState. Pairs with the validators in
// ./validation. Errors are i18n keys; the component translates them.

type Rules<T> = Partial<Record<keyof T, Validator[]>>;

export function useForm<T extends Record<string, string>>(
  initial: T,
  rules: Rules<T> = {},
) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  // Reset to a new set of values (e.g. when an edit dialog opens).
  const reset = useCallback((next: T) => {
    setValues(next);
    setTouched({});
  }, []);

  // Editing a field marks it touched — so an error only appears once the user
  // has actually typed in it (not on the autofocus blur a dialog fires on open).
  const setField = useCallback(
    (key: keyof T) => (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
    },
    [],
  );

  // Blur is a no-op for touched (kept for API symmetry / future use).
  const onBlur = useCallback((_key: keyof T) => () => {}, []);

  // Error per field (i18n key or null), regardless of touched.
  const errors = useMemo(() => {
    const out: Partial<Record<keyof T, string | null>> = {};
    for (const key of Object.keys(rules) as (keyof T)[]) {
      out[key] = firstError(values[key] ?? "", ...(rules[key] ?? []));
    }
    return out;
  }, [values, rules]);

  // Only show an error once the field has been touched.
  const errorFor = useCallback(
    (key: keyof T): string | null => (touched[key] ? errors[key] ?? null : null),
    [touched, errors],
  );

  const isValid = useMemo(
    () => Object.values(errors).every((e) => !e),
    [errors],
  );

  // Mark everything touched (call on submit attempt to surface all errors).
  const touchAll = useCallback(() => {
    const all: Partial<Record<keyof T, boolean>> = {};
    for (const key of Object.keys(values) as (keyof T)[]) all[key] = true;
    setTouched(all);
  }, [values]);

  return { values, setField, onBlur, errorFor, isValid, reset, touchAll };
}
