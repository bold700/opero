-- Employee.roles (TeamRole[]) -> Employee.role (TeamRole?), a single job title.
--
-- Backfill collapses each array to ONE value using the same precedence the
-- application already used to render the single "function" label
-- (ROLE_ORDER in backend/src/modules/employees/dto.ts):
--   ProjectLeader > Foreman > WorkPlanner > Planner > Technician > Administration > Sales
-- An empty array becomes NULL (no job title set).
--
-- Done as add-column / backfill / drop-column so no data is lost silently: the
-- old column is only dropped after every row has been assigned its primary role.

-- 1. New single-role column.
ALTER TABLE "Employee" ADD COLUMN "role" "TeamRole";

-- 2. Backfill: pick the highest-precedence role present in the array.
UPDATE "Employee"
SET "role" = CASE
  WHEN 'ProjectLeader'  = ANY("roles") THEN 'ProjectLeader'::"TeamRole"
  WHEN 'Foreman'        = ANY("roles") THEN 'Foreman'::"TeamRole"
  WHEN 'WorkPlanner'    = ANY("roles") THEN 'WorkPlanner'::"TeamRole"
  WHEN 'Planner'        = ANY("roles") THEN 'Planner'::"TeamRole"
  WHEN 'Technician'     = ANY("roles") THEN 'Technician'::"TeamRole"
  WHEN 'Administration' = ANY("roles") THEN 'Administration'::"TeamRole"
  WHEN 'Sales'          = ANY("roles") THEN 'Sales'::"TeamRole"
  ELSE NULL
END;

-- 3. Drop the array column.
ALTER TABLE "Employee" DROP COLUMN "roles";
