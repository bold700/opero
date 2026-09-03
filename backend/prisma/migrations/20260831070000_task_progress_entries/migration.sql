-- CreateTable
CREATE TABLE "TaskProgressEntry" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "employeeId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskProgressEntry_materialId_idx" ON "TaskProgressEntry"("materialId");

-- AddForeignKey
ALTER TABLE "TaskProgressEntry" ADD CONSTRAINT "TaskProgressEntry_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "TaskMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProgressEntry" ADD CONSTRAINT "TaskProgressEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

