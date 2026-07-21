// Pre-job photo check — the dispatch gate.
//
// Before a monteur is sent to a job, the office must confirm a short checklist
// AND attach at least one pre-job photo (e.g. of the site/access). The checklist
// items are now CONFIGURABLE PER ORGANIZATION (model PrejobCheckItem): an admin
// edits them in Settings. Each item has a stable `key` (keys the stored map) and
// a free-text `label`. Storage is a small JSON map key→boolean on the work order
// (WorkOrder.prejobCheck).
//
// The completeness/normalize/gate helpers therefore take the org's ACTIVE item
// keys as an argument — they can no longer close over a compile-time list.

// A checklist item as the client/PDF needs it: stable key + display label.
export type PrejobItem = { key: string; label: string };

// The stored shape: item key → done boolean. Missing = not done.
export type PrejobCheck = Record<string, boolean>;

// The default items seeded for every org (and the fallback if an org somehow
// has none). Keys match the historical hardcoded list so booleans already
// stored on existing work orders still line up.
export const DEFAULT_PREJOB_ITEMS: PrejobItem[] = [
  { key: "address_confirmed", label: "Adres en toegang bevestigd" },
  { key: "materials_ready", label: "Benodigde materialen gereed" },
  { key: "safety_reviewed", label: "Risico's en veiligheid op locatie bekeken" },
  { key: "customer_informed", label: "Klant geïnformeerd over het bezoek" },
];

// All ACTIVE items ticked? An EMPTY item set is deliberately NOT complete: an
// org must never silently disable the pre-job safety gate by clearing the list.
export function isPrejobChecklistComplete(
  check: PrejobCheck | null | undefined,
  itemKeys: string[],
): boolean {
  if (itemKeys.length === 0) return false;
  return itemKeys.every((k) => check?.[k] === true);
}

// The full dispatch gate: checklist complete AND — only when this werkbon
// requires it — at least one pre-job photo. The photo requirement is per-werkbon
// (WorkOrder.prejobPhotoRequired); default is NOT required.
export function canDispatch(
  check: PrejobCheck | null | undefined,
  prejobPhotoCount: number,
  itemKeys: string[],
  requirePhoto: boolean,
): boolean {
  const complete = isPrejobChecklistComplete(check, itemKeys);
  return complete && (!requirePhoto || prejobPhotoCount > 0);
}

// Normalize an arbitrary stored/posted value into a clean PrejobCheck: only the
// given (active) keys, only `true` booleans.
export function normalizePrejobCheck(raw: unknown, itemKeys: string[]): PrejobCheck {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out: PrejobCheck = {};
  for (const k of itemKeys) {
    if (obj[k] === true) out[k] = true;
  }
  return out;
}
