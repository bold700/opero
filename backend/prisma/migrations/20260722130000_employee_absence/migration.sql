-- Employee absence: dated periods in which someone is unavailable.
--
-- EmployeeStatus.on_leave already existed but is a permanent, dateless flag, so
-- it cannot express "away 3-17 August" nor stop being true on its own. Dates
-- are inclusive plain "YYYY-MM-DD" strings, matching WorkOrder.plannedDate and
-- PlanningItem.date (both text), so day comparisons need no timezone handling.

CREATE TYPE "AbsenceKind" AS ENUM ('vacation', 'sick', 'training', 'other');

CREATE TABLE "EmployeeAbsence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "AbsenceKind" NOT NULL DEFAULT 'vacation',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAbsence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeAbsence_orgId_idx" ON "EmployeeAbsence"("orgId");

-- Serves the overlap query: employeeId = ? AND endDate >= ? AND startDate <= ?
CREATE INDEX "EmployeeAbsence_employeeId_startDate_endDate_idx"
    ON "EmployeeAbsence"("employeeId", "startDate", "endDate");

ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "EmployeeAbsence_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeAbsence" ADD CONSTRAINT "EmployeeAbsence_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
