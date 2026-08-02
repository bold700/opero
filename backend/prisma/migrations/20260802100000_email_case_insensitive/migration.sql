-- Email is the login identity and must be case-insensitive.
--
-- Writes already lowercased (invite/email-change), but the login and
-- forgot-password lookups queried the raw input against a byte-exact unique
-- index, so a user who typed "Support@..." matched no row: login failed with
-- "invalid credentials" and forgot-password silently sent nothing (it only
-- mails inside `if (user)`).
--
-- The application now normalizes in the shared zod schemas. This migration
-- makes the database enforce the same invariant, so a future call site that
-- forgets to lowercase cannot reintroduce the split or store two users whose
-- addresses differ only by case.

-- 1. Backfill any address that isn't already lowercase.
--
-- Guarded against the case where folding would collide with an existing row
-- (e.g. both "A@x.com" and "a@x.com" exist). Those are left untouched so the
-- migration cannot destroy an account by merging two logins; the unique index
-- below will then fail loudly and the conflict can be resolved by hand.
UPDATE "User" u
SET email = lower(u.email)
WHERE u.email <> lower(u.email)
  AND NOT EXISTS (
    SELECT 1 FROM "User" other
    WHERE other.id <> u.id
      AND lower(other.email) = lower(u.email)
  );

-- 2. Enforce case-insensitive uniqueness.
--
-- A functional index on lower(email) rather than a citext column: it needs no
-- extension (so it applies cleanly on managed Postgres) and does not change the
-- column type Prisma has mapped.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(email));

-- The byte-exact "User_email_key" is deliberately KEPT alongside it. Prisma
-- cannot express a functional index, so `email` stays `@unique` in the schema —
-- that is what types `findUnique({ where: { email } })` at the three call sites
-- that use it. The functional index is the real guarantee; the plain one is now
-- strictly weaker and simply never fires first.
