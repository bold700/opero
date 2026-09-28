-- Give every active work order the organization's active controls. Existing
-- per-work-order rows are preserved by the unique (workOrderId, key) index.
INSERT INTO "WorkOrderPrejobItem" (
  "id",
  "workOrderId",
  "key",
  "label",
  "done",
  "reminderEnabled",
  "reminderTime",
  "ordinal"
)
SELECT
  gen_random_uuid()::text,
  work_order."id",
  control."key",
  control."label",
  false,
  control."reminderEnabled",
  control."reminderTime",
  control."ordinal"
FROM "WorkOrder" AS work_order
JOIN "Project" AS project ON project."id" = work_order."projectId"
JOIN "PrejobCheckItem" AS control
  ON control."orgId" = project."orgId" AND control."active" = true
WHERE work_order."signedAt" IS NULL
  AND project."archived" = false
  AND project."deletedAt" IS NULL
ON CONFLICT ("workOrderId", "key") DO NOTHING;
