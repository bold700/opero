-- Replace the former mixed progress/priority buckets with one operational
-- lifecycle. Urgency remains in WorkOrder.urgency and no longer becomes a
-- listStatus value. The column is already TEXT, so only a data backfill is
-- required.
UPDATE "WorkOrder" AS wo
SET "listStatus" = CASE
  WHEN inv."status" = 'paid' THEN 'completed'
  WHEN inv."status" = 'sent' THEN 'invoiced'
  WHEN inv."status" = 'draft' THEN 'ready_to_invoice'
  WHEN wo."approvedBySupervisor" = TRUE AND wo."signedAt" IS NOT NULL THEN 'approved'
  WHEN wo."signedAt" IS NOT NULL THEN 'ready_for_review'
  WHEN wo."dispatchedAt" IS NOT NULL THEN 'released'
  WHEN wo."plannedDate" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "_WorkOrderAssignees" a WHERE a."B" = wo."id"
  ) THEN 'planned'
  ELSE 'open'
END
FROM "Invoice" AS inv
WHERE inv."workOrderId" = wo."id";

-- Defensive fallback for legacy rows without an Invoice relation.
UPDATE "WorkOrder" AS wo
SET "listStatus" = CASE
  WHEN wo."approvedBySupervisor" = TRUE AND wo."signedAt" IS NOT NULL THEN 'approved'
  WHEN wo."signedAt" IS NOT NULL OR (
    EXISTS (SELECT 1 FROM "WorkOrderTask" t WHERE t."workOrderId" = wo."id")
    AND NOT EXISTS (
      SELECT 1 FROM "WorkOrderTask" t
      WHERE t."workOrderId" = wo."id" AND t."done" = FALSE
    )
  ) THEN 'ready_for_review'
  WHEN EXISTS (
    SELECT 1 FROM "WorkOrderTask" t
    WHERE t."workOrderId" = wo."id"
      AND (
        t."done" = TRUE
        OR t."startedAt" IS NOT NULL
        OR t."endedAt" IS NOT NULL
        OR COALESCE(t."hours", 0) > 0
      )
  ) THEN 'in_progress'
  WHEN wo."dispatchedAt" IS NOT NULL THEN 'released'
  WHEN wo."plannedDate" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "_WorkOrderAssignees" a WHERE a."B" = wo."id"
  ) THEN 'planned'
  ELSE 'open'
END
WHERE NOT EXISTS (
  SELECT 1 FROM "Invoice" inv WHERE inv."workOrderId" = wo."id"
);
