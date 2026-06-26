-- AlterTable
ALTER TABLE "ProjectActivity" ADD COLUMN     "messageKey" TEXT,
ADD COLUMN     "params" JSONB,
ALTER COLUMN "body" DROP NOT NULL;

-- Nuke legacy activity rows: they hold Dutch display prose in `body` and have no
-- messageKey. The feed is now key-based; old prose rows would render untranslated.
TRUNCATE TABLE "ProjectActivity";
