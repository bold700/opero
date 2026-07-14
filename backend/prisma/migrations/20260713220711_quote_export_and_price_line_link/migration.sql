-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "bic" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "kvkNumber" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "TaskMaterial" ADD COLUMN     "priceEntryId" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "quoteDate" TIMESTAMP(3),
ADD COLUMN     "quoteNumber" TEXT;

-- CreateIndex
CREATE INDEX "TaskMaterial_priceEntryId_idx" ON "TaskMaterial"("priceEntryId");

-- AddForeignKey
ALTER TABLE "TaskMaterial" ADD CONSTRAINT "TaskMaterial_priceEntryId_fkey" FOREIGN KEY ("priceEntryId") REFERENCES "PriceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
