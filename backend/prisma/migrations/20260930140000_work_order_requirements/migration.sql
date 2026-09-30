CREATE TABLE "WorkOrderRequirement" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'material',
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderRequirement_workOrderId_idx" ON "WorkOrderRequirement"("workOrderId");

ALTER TABLE "WorkOrderRequirement"
ADD CONSTRAINT "WorkOrderRequirement_workOrderId_fkey"
FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
