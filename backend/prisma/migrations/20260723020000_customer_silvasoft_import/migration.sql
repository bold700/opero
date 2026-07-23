-- Silvasoft import: carry the source customer number + registration numbers.
-- silvasoftId is the dedupe key for re-import (matched per org); kvkNumber and
-- vatNumber come straight from the export's KvK-nummer / BTW-nummer columns.
ALTER TABLE "Customer" ADD COLUMN "silvasoftId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "kvkNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN "vatNumber" TEXT;

CREATE INDEX "Customer_orgId_silvasoftId_idx" ON "Customer"("orgId", "silvasoftId");
