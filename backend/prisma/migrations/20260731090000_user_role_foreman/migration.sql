-- Add the `foreman` access level (meewerkend uitvoerder): field staff who sees
-- EVERYONE's work orders and planning, but nothing commercial — no prices, no
-- customers section, no reports, no account management. The permission model
-- lives in @opero/shared permissions.ts.
--
-- THIS MIGRATION MUST CONTAIN NOTHING ELSE. Postgres cannot use a new enum
-- value in the same transaction that adds it, and Prisma wraps each migration
-- in one — so any statement referencing 'foreman' has to land in a later
-- migration. Nobody is reclassified here.

ALTER TYPE "UserRole" ADD VALUE 'foreman';
