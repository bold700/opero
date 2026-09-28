ALTER TABLE "PrejobCheckItem"
ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminderTime" TEXT;

ALTER TABLE "WorkOrderPrejobItem"
ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminderTime" TEXT;

-- The existing material control is the first reminder requested by the
-- business: notify at 14:00 on the workday before the planned visit.
UPDATE "PrejobCheckItem"
SET "reminderEnabled" = true, "reminderTime" = '14:00'
WHERE "key" = 'materials_ready' AND "active" = true;

UPDATE "WorkOrderPrejobItem"
SET "reminderEnabled" = true, "reminderTime" = '14:00'
WHERE "key" = 'materials_ready' AND "done" = false;
