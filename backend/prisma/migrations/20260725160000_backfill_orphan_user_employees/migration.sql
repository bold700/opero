-- Backfill: every login must link to a domain record.
--
-- Access is managed from the Werknemers / Klanten screens (the standalone
-- "Toegang" screen is gone), so a login with neither `employeeId` nor
-- `customerId` appears on NEITHER — it is invisible and cannot be revoked
-- through the UI. Historically nothing enforced the link, so admin logins were
-- routinely created unlinked.
--
-- Going forward `createInvitedUser` takes a discriminated LinkTarget, which
-- makes an unlinked login unconstructible in TypeScript. This migration cleans
-- up the rows that predate that.
--
-- For each orphan we mint an Employee from the login's own name/email:
--   - `phone` is NOT NULL on Employee with no default -> ''
--   - `Employee.email` is nullable, so `User.email` (NOT NULL) maps cleanly
--   - roles ['Administration'] is the honest label for an office admin, and
--     puts them in the existing "office" filter bucket on Werknemers
--   - gen_random_uuid() is core in PG13+ (this project runs PG16); ids
--     elsewhere are @default(uuid()) generated app-side, so the column has no
--     DB default and must be supplied here.
--
-- IRREVERSIBLE: it creates Employee rows. Check the count before running:
--   SELECT count(*) FROM "User" WHERE "employeeId" IS NULL AND "customerId" IS NULL;

WITH orphans AS (
  SELECT id, "orgId", name, email
  FROM "User"
  WHERE "employeeId" IS NULL AND "customerId" IS NULL
),
made AS (
  INSERT INTO "Employee" (id, "orgId", name, phone, email, roles, status, "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    o."orgId",
    o.name,
    '',
    o.email,
    ARRAY['Administration']::"TeamRole"[],
    'active'::"EmployeeStatus",
    now(),
    now()
  FROM orphans o
  RETURNING id, "orgId", email
)
UPDATE "User" u
SET "employeeId" = m.id
FROM made m
WHERE u."orgId" = m."orgId"
  AND u.email = m.email
  AND u."employeeId" IS NULL
  AND u."customerId" IS NULL;
