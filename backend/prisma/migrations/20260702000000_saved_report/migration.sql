-- Named, saved analytics reports: a stored period + filter to revisit. The
-- numbers are always recomputed live; only the parameters are persisted.
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "filter" TEXT NOT NULL DEFAULT 'all',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedReport_orgId_idx" ON "SavedReport"("orgId");
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
