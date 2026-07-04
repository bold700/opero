-- Denormalized list statuses for cursor-paginated + server-filtered lists.

-- WorkOrder.listStatus: "open" | "on_the_way" | "urgent" | "done".
ALTER TABLE "WorkOrder" ADD COLUMN "listStatus" TEXT NOT NULL DEFAULT 'open';
CREATE INDEX "WorkOrder_listStatus_idx" ON "WorkOrder"("listStatus");

-- Material.stockStatus: "ok" | "low" | "out_of_stock".
ALTER TABLE "Material" ADD COLUMN "stockStatus" TEXT NOT NULL DEFAULT 'out_of_stock';
CREATE INDEX "Material_stockStatus_idx" ON "Material"("stockStatus");

-- Backfill WorkOrder.listStatus from project urgency + task completion.
-- urgent/blocked urgency wins; else all-tasks-done => done; some started/done => on_the_way; else open.
UPDATE "WorkOrder" wo SET "listStatus" = sub.status
FROM (
  SELECT w.id,
    CASE
      WHEN p."urgency" IN ('urgent', 'blocked') THEN 'urgent'
      WHEN t.total > 0 AND t.done = t.total THEN 'done'
      WHEN t.started > 0 OR t.done > 0 THEN 'on_the_way'
      ELSE 'open'
    END AS status
  FROM "WorkOrder" w
  JOIN "Project" p ON p.id = w."projectId"
  LEFT JOIN (
    SELECT "workOrderId",
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "done") AS done,
      COUNT(*) FILTER (WHERE "startedAt" IS NOT NULL) AS started
    FROM "WorkOrderTask"
    GROUP BY "workOrderId"
  ) t ON t."workOrderId" = w.id
) sub
WHERE wo.id = sub.id;

-- Backfill Material.stockStatus from linked inventory.
UPDATE "Material" m SET "stockStatus" = CASE
  WHEN i.id IS NULL THEN 'out_of_stock'
  WHEN i."quantityInStock" <= 0 THEN 'out_of_stock'
  WHEN i."quantityInStock" < i."reorderPoint" THEN 'low'
  ELSE 'ok'
END
FROM "Material" m2
LEFT JOIN "Inventory" i ON i."materialId" = m2.id
WHERE m.id = m2.id;
