-- CreateTable
CREATE TABLE "PrejobCheckItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrejobCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrejobCheckItem_orgId_idx" ON "PrejobCheckItem"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PrejobCheckItem_orgId_key_key" ON "PrejobCheckItem"("orgId", "key");

-- AddForeignKey
ALTER TABLE "PrejobCheckItem" ADD CONSTRAINT "PrejobCheckItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the 4 default checklist items for every existing org (idempotent: only
-- orgs that have none). Keys match the previous hardcoded PREJOB_CHECK_ITEMS so
-- booleans already stored on existing work orders (WorkOrder.prejobCheck) still
-- line up. gen_random_uuid() is available in Postgres 13+.
INSERT INTO "PrejobCheckItem" ("id", "orgId", "key", "label", "ordinal", "active")
SELECT gen_random_uuid(), o."id", d."key", d."label", d."ordinal", true
FROM "Organization" o
CROSS JOIN (VALUES
  ('address_confirmed', 'Adres en toegang bevestigd', 0),
  ('materials_ready',   'Benodigde materialen gereed', 1),
  ('safety_reviewed',   'Risico''s en veiligheid op locatie bekeken', 2),
  ('customer_informed', 'Klant geïnformeerd over het bezoek', 3)
) AS d("key", "label", "ordinal")
WHERE NOT EXISTS (
  SELECT 1 FROM "PrejobCheckItem" p WHERE p."orgId" = o."id"
);
