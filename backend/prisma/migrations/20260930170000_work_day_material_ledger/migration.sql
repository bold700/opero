CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "startedById" TEXT,
    "completedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkDayMaterialEntry" (
    "id" TEXT NOT NULL,
    "workDayId" TEXT NOT NULL,
    "taskMaterialId" TEXT,
    "requirementId" TEXT,
    "progressEntryId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'production',
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "plannedQuantity" DOUBLE PRECISION,
    "openingOnSite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brought" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waste" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leftOnSite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDayMaterialEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkDay_workOrderId_day_key" ON "WorkDay"("workOrderId", "day");
CREATE INDEX "WorkDay_workOrderId_status_idx" ON "WorkDay"("workOrderId", "status");
CREATE UNIQUE INDEX "WorkDayMaterialEntry_progressEntryId_key" ON "WorkDayMaterialEntry"("progressEntryId");
CREATE INDEX "WorkDayMaterialEntry_workDayId_idx" ON "WorkDayMaterialEntry"("workDayId");
CREATE INDEX "WorkDayMaterialEntry_taskMaterialId_idx" ON "WorkDayMaterialEntry"("taskMaterialId");
CREATE INDEX "WorkDayMaterialEntry_requirementId_idx" ON "WorkDayMaterialEntry"("requirementId");

ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkDayMaterialEntry" ADD CONSTRAINT "WorkDayMaterialEntry_workDayId_fkey" FOREIGN KEY ("workDayId") REFERENCES "WorkDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkDayMaterialEntry" ADD CONSTRAINT "WorkDayMaterialEntry_taskMaterialId_fkey" FOREIGN KEY ("taskMaterialId") REFERENCES "TaskMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkDayMaterialEntry" ADD CONSTRAINT "WorkDayMaterialEntry_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "WorkOrderRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkDayMaterialEntry" ADD CONSTRAINT "WorkDayMaterialEntry_progressEntryId_fkey" FOREIGN KEY ("progressEntryId") REFERENCES "TaskProgressEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
