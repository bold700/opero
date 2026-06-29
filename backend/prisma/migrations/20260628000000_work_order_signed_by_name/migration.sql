-- The signer's typed name at sign-off (often the customer's), printed on the
-- work order record alongside the drawn signature image.
ALTER TABLE "WorkOrder" ADD COLUMN "signedByName" TEXT;
