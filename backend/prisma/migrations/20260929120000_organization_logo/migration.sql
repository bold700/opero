ALTER TABLE "Organization" ADD COLUMN "logo" TEXT;

ALTER TABLE "Invoice"
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceDate" TEXT,
  ADD COLUMN "dueDate" TEXT;
