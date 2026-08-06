-- Per-visit description on the werkbon, and the client's own reference number
-- on the project.
--
-- WorkOrder.description: a project groups many werkbonnen, so "what this visit
-- is about" ("2e verdieping, week 38") belongs on the werkbon, not the project.
-- Nullable: an existing werkbon has none, and the printed werkbon falls back to
-- the project's description.
--
-- Project.referenceNumber: the CLIENT's own order/PO/dossier number. Project
-- .projectNumber stays Opero's OWN internal identity (OP-YYYY-NNN) and is not
-- repurposed for this.

ALTER TABLE "WorkOrder" ADD COLUMN "description" TEXT;

ALTER TABLE "Project" ADD COLUMN "referenceNumber" TEXT;
