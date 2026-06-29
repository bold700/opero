-- Pre-job check + dispatch gate on the work order. A monteur may not be
-- dispatched until the pre-job checklist is complete and >=1 pre-job photo
-- exists. prejobCheck = JSON map of checklist key -> done; prejobPhotos = object
-- keys; dispatchedAt set -> the job has been sent out.
ALTER TABLE "WorkOrder" ADD COLUMN "prejobCheck" JSONB;
ALTER TABLE "WorkOrder" ADD COLUMN "prejobPhotos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "WorkOrder" ADD COLUMN "dispatchedAt" TIMESTAMP(3);
ALTER TABLE "WorkOrder" ADD COLUMN "dispatchedById" TEXT;
