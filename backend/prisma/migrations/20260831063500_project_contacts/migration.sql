-- CreateTable
CREATE TABLE "_ProjectContacts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectContacts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProjectContacts_B_index" ON "_ProjectContacts"("B");

-- AddForeignKey
ALTER TABLE "_ProjectContacts" ADD CONSTRAINT "_ProjectContacts_A_fkey" FOREIGN KEY ("A") REFERENCES "ContactPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectContacts" ADD CONSTRAINT "_ProjectContacts_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

