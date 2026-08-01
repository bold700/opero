import { useMemo } from "react";

// "Has this form actually changed?" — the check behind disabling Save on an
// untouched edit form.
//
// Comparing VALUES rather than tracking edits is deliberate: a "was this field
// typed in" flag stays true after the user types a character and deletes it
// again, which would leave Save enabled on a form that is byte-for-byte what it
// was seeded with.

// Strings are trimmed because every form trims on submit — an added trailing
// space is not a change anyone can save. Null, undefined and "" all mean
// "empty": forms seed a cleared optional field as "" and send back null, and
// that round-trip must not read as an edit.
function normalize(value: unknown): unknown {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  const left = normalize(a);
  const right = normalize(b);
  // Arrays of primitives (e.g. an employee's roles) compare by members, order
  // insensitive — reordering the same set is not an edit.
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    const remaining = [...right];
    for (const item of left) {
      const at = remaining.findIndex((candidate) => sameValue(item, candidate));
      if (at === -1) return false;
      remaining.splice(at, 1);
    }
    return true;
  }
  // Object.is, not ===, so NaN (a number field mid-edit) equals itself rather
  // than marking the form permanently dirty.
  return Object.is(left, right);
}

// Shallow compare over the union of both objects' keys — union, not just
// `current`'s, so a key that exists only on the baseline still counts as a
// change when the form drops it.
export function isDirty<T extends object>(current: T, initial: T | null | undefined): boolean {
  if (!initial) return false;
  const keys = new Set([...Object.keys(current), ...Object.keys(initial)]);
  for (const key of keys) {
    const a = (current as Record<string, unknown>)[key];
    const b = (initial as Record<string, unknown>)[key];
    if (!sameValue(a, b)) return true;
  }
  return false;
}

// Hook form of the same check. `initial` is the seeded baseline; pass null while
// it is still unknown (e.g. the record hasn't loaded), which reads as "not
// dirty" so Save stays disabled rather than enabled-by-accident.
export function useDirty<T extends object>(
  current: T,
  initial: T | null | undefined,
): boolean {
  return useMemo(() => isDirty(current, initial), [current, initial]);
}
