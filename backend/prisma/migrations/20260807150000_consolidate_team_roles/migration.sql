-- Consolidate job titles 7 → 4 (UX review: combine similar roles).
--
-- Sales, WorkPlanner, Planner and Administration all behaved identically in the
-- app (the office/field filter and the assignment pickers treat them as
-- "office"), so they merge into one Office title. ProjectLeader, Foreman and
-- Technician stay: each drives real assignability rules.
--
-- Postgres cannot drop enum values in place, so the type is rebuilt and the
-- column remapped in the same cast.

ALTER TYPE "TeamRole" RENAME TO "TeamRole_old";

CREATE TYPE "TeamRole" AS ENUM ('Office', 'ProjectLeader', 'Foreman', 'Technician');

ALTER TABLE "Employee" ALTER COLUMN "role" TYPE "TeamRole" USING (
  CASE "role"::text
    WHEN 'Sales' THEN 'Office'
    WHEN 'WorkPlanner' THEN 'Office'
    WHEN 'Planner' THEN 'Office'
    WHEN 'Administration' THEN 'Office'
    ELSE "role"::text
  END
)::"TeamRole";

DROP TYPE "TeamRole_old";
