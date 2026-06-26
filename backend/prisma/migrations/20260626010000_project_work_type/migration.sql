-- Project work type becomes a managed reference. workTypeId is the source of
-- truth (FK -> WorkType); insulationType stays as a denormalized display mirror.
ALTER TABLE "Project" ADD COLUMN "workTypeId" TEXT;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
