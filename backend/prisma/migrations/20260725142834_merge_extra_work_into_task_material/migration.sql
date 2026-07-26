/*
  Warnings:

  - You are about to drop the `ExtraWork` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExtraWork" DROP CONSTRAINT "ExtraWork_variantId_fkey";

-- DropForeignKey
ALTER TABLE "ExtraWork" DROP CONSTRAINT "ExtraWork_workOrderId_fkey";

-- AlterTable
ALTER TABLE "TaskMaterial" ADD COLUMN     "approvedByClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedByOffice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isExtraWork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photos" TEXT[],
ADD COLUMN     "rejected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectedBy" "ExtraWorkRejectedBy";

-- DropTable
DROP TABLE "ExtraWork";

-- CreateIndex
CREATE INDEX "TaskMaterial_taskId_isExtraWork_idx" ON "TaskMaterial"("taskId", "isExtraWork");
