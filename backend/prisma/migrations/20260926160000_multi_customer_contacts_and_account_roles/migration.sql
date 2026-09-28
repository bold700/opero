-- Every existing login starts with its current role as its only allowed role.
ALTER TABLE "User"
ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[];

UPDATE "User"
SET "roles" = ARRAY["role"]::"UserRole"[];

-- A contact keeps its original owning customer and may additionally be linked
-- to other customers. The composite key prevents duplicate links.
CREATE TABLE "_SharedCustomerContacts" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_SharedCustomerContacts_AB_unique"
ON "_SharedCustomerContacts"("A", "B");

CREATE INDEX "_SharedCustomerContacts_B_index"
ON "_SharedCustomerContacts"("B");

ALTER TABLE "_SharedCustomerContacts"
ADD CONSTRAINT "_SharedCustomerContacts_A_fkey"
FOREIGN KEY ("A") REFERENCES "ContactPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_SharedCustomerContacts"
ADD CONSTRAINT "_SharedCustomerContacts_B_fkey"
FOREIGN KEY ("B") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
