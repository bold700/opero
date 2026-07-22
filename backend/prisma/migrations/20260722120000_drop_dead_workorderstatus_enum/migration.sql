-- Drop the unused "WorkOrderStatus" enum type.
--
-- It was never referenced by any model column: the live status lives on
-- "WorkOrder"."listStatus" (a plain text column) with a different value set
-- (open | on_the_way | urgent | done), derived by deriveWorkOrderStatus().
-- The dead enum declared a "completed" value the runtime never produces, which
-- misled readers into thinking status was wired up wrong.
DROP TYPE IF EXISTS "WorkOrderStatus";
