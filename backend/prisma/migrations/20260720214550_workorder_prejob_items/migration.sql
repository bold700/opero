-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "prejobPhotoRequired" BOOLEAN;

-- CreateTable
CREATE TABLE "WorkOrderPrejobItem" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkOrderPrejobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderPrejobItem_workOrderId_idx" ON "WorkOrderPrejobItem"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderPrejobItem_workOrderId_key_key" ON "WorkOrderPrejobItem"("workOrderId", "key");

-- AddForeignKey
ALTER TABLE "WorkOrderPrejobItem" ADD CONSTRAINT "WorkOrderPrejobItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: snapshot each existing work order's checklist from its org's ACTIVE
-- template items, carrying over any `done=true` already recorded in the legacy
-- WorkOrder.prejobCheck JSON map (matched by key). Idempotent (skip work orders
-- that already have per-werkbon items).
INSERT INTO "WorkOrderPrejobItem" ("id", "workOrderId", "key", "label", "done", "ordinal")
SELECT
  gen_random_uuid(),
  wo."id",
  t."key",
  t."label",
  COALESCE((wo."prejobCheck" -> t."key")::boolean, false),
  t."ordinal"
FROM "WorkOrder" wo
JOIN "Project" p ON p."id" = wo."projectId"
JOIN "PrejobCheckItem" t ON t."orgId" = p."orgId" AND t."active" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkOrderPrejobItem" wi WHERE wi."workOrderId" = wo."id"
);
