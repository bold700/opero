-- Add a unit price to the Material catalog (prefilled onto werkbon material lines).
ALTER TABLE "Material" ADD COLUMN "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
