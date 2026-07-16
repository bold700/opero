-- DropForeignKey
ALTER TABLE "ExtraWork" DROP CONSTRAINT "ExtraWork_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_projectId_fkey";

-- DropForeignKey
ALTER TABLE "PlanningItem" DROP CONSTRAINT "PlanningItem_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_projectId_fkey";

-- DropIndex
DROP INDEX "ExtraWork_projectId_idx";

-- DropIndex
DROP INDEX "Invoice_projectId_key";

-- DropIndex
DROP INDEX "PlanningItem_projectId_idx";

-- DropIndex
DROP INDEX "Quote_projectId_key";

-- AlterTable
ALTER TABLE "ExtraWork" DROP COLUMN "projectId",
ADD COLUMN     "workOrderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "projectId",
ADD COLUMN     "workOrderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PlanningItem" DROP COLUMN "projectId",
ADD COLUMN     "workOrderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "plannedDate",
DROP COLUMN "plannedEndDate";

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "projectId",
ADD COLUMN     "workOrderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "plannedDate" TEXT,
ADD COLUMN     "plannedEndDate" TEXT,
ADD COLUMN     "value" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ExtraWork_workOrderId_idx" ON "ExtraWork"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workOrderId_key" ON "Invoice"("workOrderId");

-- CreateIndex
CREATE INDEX "PlanningItem_workOrderId_idx" ON "PlanningItem"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_workOrderId_key" ON "Quote"("workOrderId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraWork" ADD CONSTRAINT "ExtraWork_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningItem" ADD CONSTRAINT "PlanningItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

