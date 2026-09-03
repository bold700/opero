-- AlterTable
ALTER TABLE "WorkOrderAttachment" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'document',
ADD COLUMN     "receivedAt" TIMESTAMP(3);

