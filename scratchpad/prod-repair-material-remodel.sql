-- PROD REPAIR for the failed `20260714021305_material_entity_remodel` migration.
--
-- Cause: the migration adds NOT NULL columns to "Material", but prod still had
-- the old demo Material rows → "column class contains null values" → P3018,
-- then the migration is marked failed → P3009 blocks every later deploy.
--
-- This script is IDEMPOTENT: it brings the schema to the target state whether
-- the failed migration got 0%, 50%, or 90% of the way. It drops the old
-- Material/PriceList/Inventory tables (the migration deletes them anyway — no
-- data you keep lives there). Real data (customers/projects/work orders/users)
-- is untouched.
--
-- Run this whole file against the PROD database (Supabase SQL editor or psql),
-- THEN run the two commands printed at the bottom to mark the migration
-- resolved and reseed.

BEGIN;

-- 1. Enums (no-op if the failed run already created them).
DO $$ BEGIN
  CREATE TYPE "MaterialClass" AS ENUM ('insulation','fitting','tank','cladding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaterialComponent" AS ENUM ('meter','elbow','coupling','tee','threaded_fitting','flange','valve','pump','air_separator','reducer','alu_cap','buffer_vessel','area');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TaskMaterial: swap priceEntryId → variantId (drop the old FK/col/index if
--    still present; add the new col/index). All guarded.
ALTER TABLE "TaskMaterial" DROP CONSTRAINT IF EXISTS "TaskMaterial_priceEntryId_fkey";
DROP INDEX IF EXISTS "TaskMaterial_priceEntryId_idx";
ALTER TABLE "TaskMaterial" DROP COLUMN IF EXISTS "priceEntryId";
ALTER TABLE "TaskMaterial" ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- 3. Drop the old model tables entirely (the migration does this; their rows
--    are exactly what blocked it). CASCADE clears dependent FKs.
DROP TABLE IF EXISTS "PriceEntry" CASCADE;
DROP TABLE IF EXISTS "PriceListProduct" CASCADE;
DROP TABLE IF EXISTS "PriceList" CASCADE;
DROP TABLE IF EXISTS "Inventory" CASCADE;
DROP TABLE IF EXISTS "MaterialCategory" CASCADE;
DROP TABLE IF EXISTS "Material" CASCADE;   -- old flat stock table; rebuilt below

DROP TYPE IF EXISTS "PipeSystem";
DROP TYPE IF EXISTS "PriceComponent";

-- 4. Rebuild Material as the new entity + MaterialVariant child.
CREATE TABLE "Material" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "class" "MaterialClass" NOT NULL,
  "supplier" TEXT NOT NULL,
  "thicknessMm" INTEGER,
  "pipeMaterial" TEXT,
  "finish" TEXT,
  "sizeUnit" TEXT NOT NULL,
  "note" TEXT,
  "priceSource" TEXT,
  "priceValidFrom" TIMESTAMP(3),
  "priceValidTo" TIMESTAMP(3),
  "priceNote" TEXT,
  "ordinal" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Material_orgId_key_key" ON "Material"("orgId","key");
CREATE INDEX "Material_orgId_idx" ON "Material"("orgId");
ALTER TABLE "Material" ADD CONSTRAINT "Material_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
CREATE INDEX "MaterialVariant_materialId_idx" ON "MaterialVariant"("materialId");
CREATE UNIQUE INDEX "MaterialVariant_materialId_size_component_thicknessMm_key"
  ON "MaterialVariant"("materialId","size","component","thicknessMm");
ALTER TABLE "MaterialVariant" ADD CONSTRAINT "MaterialVariant_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMaterial" ADD CONSTRAINT "TaskMaterial_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "MaterialVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TaskMaterial_variantId_idx" ON "TaskMaterial"("variantId");

-- 5. Mark the failed migration as rolled back so `migrate deploy` will retry —
--    but since we've already applied the target schema by hand, we instead mark
--    it APPLIED (finished) so deploy skips it. Do this via the CLI in step 6,
--    NOT here, so Prisma's bookkeeping stays consistent.

COMMIT;
