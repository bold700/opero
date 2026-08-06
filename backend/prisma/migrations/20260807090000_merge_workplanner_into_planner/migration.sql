-- Merge the WorkPlanner job title into Planner (UX review: combine similar
-- roles). The two titles were near-duplicates nobody could tell apart in the
-- picker; Planner survives as the single planning title.
--
-- Postgres cannot drop a value from an enum in place, so the type is rebuilt:
-- remap the rows, swap the type out under the column, drop the old type.

UPDATE "Employee" SET "role" = 'Planner' WHERE "role" = 'WorkPlanner';

ALTER TYPE "TeamRole" RENAME TO "TeamRole_old";

CREATE TYPE "TeamRole" AS ENUM ('Sales', 'Planner', 'Foreman', 'Technician', 'Administration', 'ProjectLeader');

ALTER TABLE "Employee" ALTER COLUMN "role" TYPE "TeamRole" USING ("role"::text::"TeamRole");

DROP TYPE "TeamRole_old";
