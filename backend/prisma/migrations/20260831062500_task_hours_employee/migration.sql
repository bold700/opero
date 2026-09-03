-- AlterTable
ALTER TABLE "WorkOrderTask" ADD COLUMN     "hoursEmployeeId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkOrderTask" ADD CONSTRAINT "WorkOrderTask_hoursEmployeeId_fkey" FOREIGN KEY ("hoursEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

