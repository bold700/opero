-- Organization gets company/billing details + the org-wide hide-prices flag.
ALTER TABLE "Organization" ADD COLUMN "email" TEXT;
ALTER TABLE "Organization" ADD COLUMN "address" TEXT;
ALTER TABLE "Organization" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Organization" ADD COLUMN "city" TEXT;
ALTER TABLE "Organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "vatNumber" TEXT;
ALTER TABLE "Organization" ADD COLUMN "hidePricesFromTechnicians" BOOLEAN NOT NULL DEFAULT true;
