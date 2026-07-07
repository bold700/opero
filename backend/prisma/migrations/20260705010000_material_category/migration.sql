-- Per-org, user-managed material categories (replaces the hardcoded global enum).
CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialCategory_orgId_name_key" ON "MaterialCategory"("orgId", "name");
CREATE INDEX "MaterialCategory_orgId_idx" ON "MaterialCategory"("orgId");
ALTER TABLE "MaterialCategory" ADD CONSTRAINT "MaterialCategory_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the previous hardcoded defaults for every existing org, so each starts
-- with the same categories it had before (and existing materials still match).
INSERT INTO "MaterialCategory" ("id", "orgId", "name", "sortOrder")
SELECT gen_random_uuid(), o."id", d.name, d.ord
FROM "Organization" o
CROSS JOIN (VALUES
  ('insulation', 0),
  ('fastening', 1),
  ('foil', 2),
  ('sealing', 3),
  ('tools', 4),
  ('floor_insulation', 5),
  ('other', 6)
) AS d(name, ord)
ON CONFLICT ("orgId", "name") DO NOTHING;

-- Also make sure any category value already used by existing materials exists as
-- a row (in case a material had a value outside the default set).
INSERT INTO "MaterialCategory" ("id", "orgId", "name", "sortOrder")
SELECT gen_random_uuid(), m."orgId", m."category", 100
FROM "Material" m
WHERE m."category" IS NOT NULL AND m."category" <> ''
ON CONFLICT ("orgId", "name") DO NOTHING;
