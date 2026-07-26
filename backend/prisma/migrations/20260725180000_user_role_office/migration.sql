-- Add the `office` access level: office staff get the full operational app, but
-- never login provisioning or org configuration. Splits "the owner" (admin)
-- from "office staff", which were previously the same flag.
--
-- THIS MIGRATION MUST CONTAIN NOTHING ELSE. Postgres cannot use a new enum
-- value in the same transaction that adds it, and Prisma wraps each migration
-- in one — so any statement referencing 'office' has to land in a later
-- migration. Nobody is reclassified here: existing admins stay admin.

ALTER TYPE "UserRole" ADD VALUE 'office';
