// Pre-job photo check — the dispatch gate.
//
// Before a monteur is sent to a job, the office must confirm a short checklist
// AND attach at least one pre-job photo (e.g. of the site/access). The checklist
// item keys are ENGLISH internals; the client renders Dutch/English labels via
// i18n (prejob.items.<key>). Storage is a small JSON map key→boolean on the
// work order (WorkOrder.prejobCheck).

export const PREJOB_CHECK_ITEMS = [
  "address_confirmed", // job address + access confirmed
  "materials_ready", // required materials are available/loaded
  "safety_reviewed", // site risks / safety reviewed
  "customer_informed", // customer notified of the visit
] as const;

export type PrejobCheckItem = (typeof PREJOB_CHECK_ITEMS)[number];

// The stored shape: every item key → done boolean. Missing = not done.
export type PrejobCheck = Partial<Record<PrejobCheckItem, boolean>>;

// All checklist items ticked?
export function isPrejobChecklistComplete(check: PrejobCheck | null | undefined): boolean {
  if (!check) return false;
  return PREJOB_CHECK_ITEMS.every((k) => check[k] === true);
}

// The full dispatch gate: checklist complete AND at least one pre-job photo.
export function canDispatch(
  check: PrejobCheck | null | undefined,
  prejobPhotoCount: number,
): boolean {
  return isPrejobChecklistComplete(check) && prejobPhotoCount > 0;
}

// Normalize an arbitrary stored/posted value into a clean PrejobCheck (only the
// known keys, only booleans).
export function normalizePrejobCheck(raw: unknown): PrejobCheck {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out: PrejobCheck = {};
  for (const k of PREJOB_CHECK_ITEMS) {
    if (obj[k] === true) out[k] = true;
  }
  return out;
}
