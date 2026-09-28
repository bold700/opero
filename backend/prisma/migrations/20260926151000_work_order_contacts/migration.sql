CREATE TABLE "_WorkOrderContacts" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_WorkOrderContacts_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_WorkOrderContacts_B_index"
ON "_WorkOrderContacts"("B");

ALTER TABLE "_WorkOrderContacts"
ADD CONSTRAINT "_WorkOrderContacts_A_fkey"
FOREIGN KEY ("A") REFERENCES "ContactPerson"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_WorkOrderContacts"
ADD CONSTRAINT "_WorkOrderContacts_B_fkey"
FOREIGN KEY ("B") REFERENCES "WorkOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "_WorkOrderContacts" ("A", "B")
SELECT "contactPersonId", "id"
FROM "WorkOrder"
WHERE "contactPersonId" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "WorkOrder"
DROP CONSTRAINT "WorkOrder_contactPersonId_fkey";

DROP INDEX "WorkOrder_contactPersonId_idx";

ALTER TABLE "WorkOrder"
DROP COLUMN "contactPersonId";
