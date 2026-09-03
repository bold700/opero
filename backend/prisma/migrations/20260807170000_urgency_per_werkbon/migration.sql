-- Urgency redesign, two structural fixes in one migration:
--
-- 1. `blocked` stops being an urgency value. Blocked is workflow state
--    ("cannot proceed") with its own columns (blocker/blockerKey); keeping it
--    in the urgency enum made werkbonnen of stalled projects display "Spoed".
--    The enum shrinks to normal|urgent; blocked-ness derives from the blocker
--    columns. Projects that were manually set to blocked without a recorded
--    blocker get blockerKey='manuallyBlocked' so no blocked state is lost.
--
-- 2. Urgency moves to the WERKBON — the unit of work that owns scheduling and
--    billing. "This visit is urgent" was inexpressible: project-level urgency
--    stamped every sibling werkbon. Existing werkbonnen inherit their
--    project's value, then the project column is dropped. listStatus now
--    derives from a column on the SAME row, so the cross-table desync class
--    of bug (stale statuses after an urgency change) ceases to exist.

ALTER TYPE "ProjectUrgency" RENAME TO "ProjectUrgency_old";
CREATE TYPE "Urgency" AS ENUM ('normal', 'urgent');

ALTER TABLE "WorkOrder" ADD COLUMN "urgency" "Urgency" NOT NULL DEFAULT 'normal';

UPDATE "WorkOrder" w
SET "urgency" = 'urgent'
FROM "Project" p
WHERE p.id = w."projectId" AND p."urgency"::text = 'urgent';

UPDATE "Project"
SET "blockerKey" = 'manuallyBlocked'
WHERE "urgency"::text = 'blocked' AND "blocker" IS NULL AND "blockerKey" IS NULL;

ALTER TABLE "Project" DROP COLUMN "urgency";

DROP TYPE "ProjectUrgency_old";
