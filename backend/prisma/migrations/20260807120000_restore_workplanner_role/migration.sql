-- Restore the WorkPlanner job title, reverting 20260807090000.
--
-- Werkvoorbereider (WorkPlanner) and Planner are separate desks in installation
-- work — preparing a job is not scheduling it — so the two titles were never
-- duplicates and must not be collapsed.
--
-- Adding a value back to an enum is safe and non-destructive. Employees that
-- 20260807090000 remapped to Planner are NOT restored: that migration dropped
-- the information about who had been a WorkPlanner, so their title has to be
-- set again by hand in the app.

ALTER TYPE "TeamRole" ADD VALUE IF NOT EXISTS 'WorkPlanner' AFTER 'Sales';
