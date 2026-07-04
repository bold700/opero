import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db/client.js";

// Denormalized material stock status. Derived from the linked inventory's
// quantityInStock vs reorderPoint, but persisted on Material.stockStatus so the
// list endpoint can filter/count/paginate on a real indexed column. Single
// source of both the derivation and the sync — call recomputeMaterialStock at
// every inventory mutation (create/update quantity or reorderPoint, delete).

export type MaterialStockStatus = "ok" | "low" | "out_of_stock";

type Db = PrismaClient | Prisma.TransactionClient;

// Pure derivation. No inventory row (or zero/negative stock) → out_of_stock.
export function deriveStockStatus(
  inv: { quantityInStock: number; reorderPoint: number } | null | undefined,
): MaterialStockStatus {
  if (!inv) return "out_of_stock";
  if (inv.quantityInStock <= 0) return "out_of_stock";
  if (inv.quantityInStock < inv.reorderPoint) return "low";
  return "ok";
}

// Recompute + persist stockStatus for ONE material. Returns the value written.
export async function recomputeMaterialStock(
  db: Db,
  materialId: string,
): Promise<MaterialStockStatus | null> {
  const material = await db.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      inventory: { select: { quantityInStock: true, reorderPoint: true } },
    },
  });
  if (!material) return null;
  const status = deriveStockStatus(material.inventory);
  await db.material.update({
    where: { id: materialId },
    data: { stockStatus: status },
  });
  return status;
}

// Backfill helper (data migration + tests): recompute for every material.
export async function backfillAllMaterialStock(): Promise<void> {
  const materials = await prisma.material.findMany({ select: { id: true } });
  for (const m of materials) {
    await recomputeMaterialStock(prisma, m.id);
  }
}
