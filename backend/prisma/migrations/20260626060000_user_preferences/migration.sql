-- Per-user preferences (language + notification toggles) as a JSON blob.
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;
