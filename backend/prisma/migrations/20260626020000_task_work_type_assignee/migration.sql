-- Each task (zone) carries its own work type + assigned technician.
ALTER TABLE "WorkOrderTask" ADD COLUMN "workTypeId" TEXT;
ALTER TABLE "WorkOrderTask" ADD COLUMN "assigneeId" TEXT;

ALTER TABLE "WorkOrderTask"
  ADD CONSTRAINT "WorkOrderTask_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrderTask"
  ADD CONSTRAINT "WorkOrderTask_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
