import { DEFAULT_PREJOB_ITEMS, type PrejobItem } from "@opero/shared";
import { prisma } from "../db/client.js";

// Load an org's ACTIVE pre-job checklist items, ordered. Falls back to the
// built-in defaults if the org has none configured (should not happen after the
// seed migration, but keeps the dispatch gate meaningful rather than empty).
export async function getPrejobItems(orgId: string): Promise<PrejobItem[]> {
  const rows = await prisma.prejobCheckItem.findMany({
    where: { orgId, active: true },
    orderBy: { ordinal: "asc" },
    select: { key: true, label: true },
  });
  return rows.length > 0 ? rows : DEFAULT_PREJOB_ITEMS;
}
