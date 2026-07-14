-- CreateEnum
CREATE TYPE "PriceComponent" AS ENUM ('meter', 'elbow', 'coupling', 'tee', 'threaded_fitting', 'flange', 'valve', 'pump', 'air_separator', 'reducer', 'alu_cap', 'buffer_vessel', 'area');

-- CreateEnum
CREATE TYPE "PipeSystem" AS ENUM ('chilled_water', 'heating', 'cold_hot_circulation', 'drainage', 'cladding', 'general');

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListProduct" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" "PipeSystem" NOT NULL,
    "pipeMaterial" TEXT,
    "thicknessMm" INTEGER,
    "finish" TEXT,
    "sizeUnit" TEXT NOT NULL,
    "note" TEXT,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "PriceListProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceEntry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "component" "PriceComponent" NOT NULL,
    "thicknessMm" INTEGER,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "PriceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceList_orgId_idx" ON "PriceList"("orgId");

-- CreateIndex
CREATE INDEX "PriceListProduct_priceListId_idx" ON "PriceListProduct"("priceListId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListProduct_priceListId_key_key" ON "PriceListProduct"("priceListId", "key");

-- CreateIndex
CREATE INDEX "PriceEntry_productId_idx" ON "PriceEntry"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceEntry_productId_size_component_thicknessMm_key" ON "PriceEntry"("productId", "size", "component", "thicknessMm");

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListProduct" ADD CONSTRAINT "PriceListProduct_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceEntry" ADD CONSTRAINT "PriceEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PriceListProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
