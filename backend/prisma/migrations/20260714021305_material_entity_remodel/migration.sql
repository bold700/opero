-- CreateEnum
CREATE TYPE "MaterialClass" AS ENUM ('insulation', 'fitting', 'tank', 'cladding');

-- CreateEnum
CREATE TYPE "MaterialComponent" AS ENUM ('meter', 'elbow', 'coupling', 'tee', 'threaded_fitting', 'flange', 'valve', 'pump', 'air_separator', 'reducer', 'alu_cap', 'buffer_vessel', 'area');

-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "Inventory_materialId_fkey";

-- DropForeignKey
ALTER TABLE "MaterialCategory" DROP CONSTRAINT "MaterialCategory_orgId_fkey";

-- DropForeignKey
ALTER TABLE "PriceEntry" DROP CONSTRAINT "PriceEntry_productId_fkey";

-- DropForeignKey
ALTER TABLE "PriceList" DROP CONSTRAINT "PriceList_orgId_fkey";

-- DropForeignKey
ALTER TABLE "PriceListProduct" DROP CONSTRAINT "PriceListProduct_priceListId_fkey";

-- DropForeignKey
ALTER TABLE "TaskMaterial" DROP CONSTRAINT "TaskMaterial_priceEntryId_fkey";

-- DropIndex
DROP INDEX "Material_stockStatus_idx";

-- DropIndex
DROP INDEX "TaskMaterial_priceEntryId_idx";

-- AlterTable
ALTER TABLE "Material" DROP COLUMN "category",
DROP COLUMN "deletedAt",
DROP COLUMN "stockStatus",
DROP COLUMN "unit",
DROP COLUMN "unitPrice",
ADD COLUMN     "class" "MaterialClass" NOT NULL,
ADD COLUMN     "finish" TEXT,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "ordinal" INTEGER NOT NULL,
ADD COLUMN     "pipeMaterial" TEXT,
ADD COLUMN     "priceNote" TEXT,
ADD COLUMN     "priceSource" TEXT,
ADD COLUMN     "priceValidFrom" TIMESTAMP(3),
ADD COLUMN     "priceValidTo" TIMESTAMP(3),
ADD COLUMN     "sizeUnit" TEXT NOT NULL,
ADD COLUMN     "supplier" TEXT NOT NULL,
ADD COLUMN     "thicknessMm" INTEGER;

-- AlterTable
ALTER TABLE "TaskMaterial" DROP COLUMN "priceEntryId",
ADD COLUMN     "variantId" TEXT;

-- DropTable
DROP TABLE "Inventory";

-- DropTable
DROP TABLE "MaterialCategory";

-- DropTable
DROP TABLE "PriceEntry";

-- DropTable
DROP TABLE "PriceList";

-- DropTable
DROP TABLE "PriceListProduct";

-- DropEnum
DROP TYPE "PipeSystem";

-- DropEnum
DROP TYPE "PriceComponent";

-- CreateTable
CREATE TABLE "MaterialVariant" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "component" "MaterialComponent" NOT NULL,
    "thicknessMm" INTEGER,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "MaterialVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialVariant_materialId_idx" ON "MaterialVariant"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialVariant_materialId_size_component_thicknessMm_key" ON "MaterialVariant"("materialId", "size", "component", "thicknessMm");

-- CreateIndex
CREATE UNIQUE INDEX "Material_orgId_key_key" ON "Material"("orgId", "key");

-- CreateIndex
CREATE INDEX "TaskMaterial_variantId_idx" ON "TaskMaterial"("variantId");

-- AddForeignKey
ALTER TABLE "MaterialVariant" ADD CONSTRAINT "MaterialVariant_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskMaterial" ADD CONSTRAINT "TaskMaterial_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MaterialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

