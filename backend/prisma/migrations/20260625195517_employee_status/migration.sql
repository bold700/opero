-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'on_leave', 'inactive');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "status" "EmployeeStatus" NOT NULL DEFAULT 'active';
