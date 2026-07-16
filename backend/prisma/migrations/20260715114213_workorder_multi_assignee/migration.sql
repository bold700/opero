-- Werkbon monteur assignment goes from single (WorkOrder.assigneeId) to
-- many-to-many (implicit relation "WorkOrderAssignees"). Existing single
-- assignments are migrated into the join table before the column is dropped.

-- CreateTable: implicit m2m join (A = Employee, B = WorkOrder — alphabetical).
CREATE TABLE "_WorkOrderAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_WorkOrderAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_WorkOrderAssignees_B_index" ON "_WorkOrderAssignees"("B");

-- Migrate existing single assignments into the join (A = employee, B = werkbon).
INSERT INTO "_WorkOrderAssignees" ("A", "B")
SELECT "assigneeId", "id" FROM "WorkOrder" WHERE "assigneeId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "_WorkOrderAssignees" ADD CONSTRAINT "_WorkOrderAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkOrderAssignees" ADD CONSTRAINT "_WorkOrderAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old single-assignee column + its index/FK.
DROP INDEX IF EXISTS "WorkOrder_assigneeId_idx";
ALTER TABLE "WorkOrder" DROP CONSTRAINT IF EXISTS "WorkOrder_assigneeId_fkey";
ALTER TABLE "WorkOrder" DROP COLUMN "assigneeId";
