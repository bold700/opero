-- AlterTable
ALTER TABLE "ExtraWork" ADD COLUMN     "costPrice" DOUBLE PRECISION,
ADD COLUMN     "variantId" TEXT;

-- CreateIndex
CREATE INDEX "ExtraWork_variantId_idx" ON "ExtraWork"("variantId");

-- AddForeignKey
ALTER TABLE "ExtraWork" ADD CONSTRAINT "ExtraWork_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MaterialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
