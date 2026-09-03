-- AlterTable
ALTER TABLE "ContactPerson" ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT;


-- Backfill: split the existing display name on its first space.
UPDATE "ContactPerson"
SET "firstName" = split_part("name", ' ', 1),
    "lastName"  = CASE WHEN position(' ' IN "name") > 0
                       THEN substr("name", position(' ' IN "name") + 1)
                       ELSE '' END
WHERE "firstName" = '' AND "lastName" = '';
