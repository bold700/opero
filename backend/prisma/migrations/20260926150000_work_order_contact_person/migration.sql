ALTER TABLE "WorkOrder"
ADD COLUMN "contactPersonId" TEXT;

CREATE INDEX "WorkOrder_contactPersonId_idx"
ON "WorkOrder"("contactPersonId");

ALTER TABLE "WorkOrder"
ADD CONSTRAINT "WorkOrder_contactPersonId_fkey"
FOREIGN KEY ("contactPersonId") REFERENCES "ContactPerson"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
