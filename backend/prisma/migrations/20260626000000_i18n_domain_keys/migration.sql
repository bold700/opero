-- Project: store nextStep as a language-neutral i18n key; add blockerKey for the
-- system-default blocker (free-text `blocker` stays for user-entered reasons).
-- Rename keeps existing rows; values are reset to keys by the re-seed below
-- (the prior Dutch nextStep prose is replaced wholesale).
ALTER TABLE "Project" RENAME COLUMN "nextStep" TO "nextStepKey";
ALTER TABLE "Project" ADD COLUMN "blockerKey" TEXT;

-- DeliveryChecklistItem + HandoverItem: label prose -> i18n key.
ALTER TABLE "DeliveryChecklistItem" RENAME COLUMN "label" TO "labelKey";
ALTER TABLE "HandoverItem" RENAME COLUMN "label" TO "labelKey";

-- Nuke any stored Dutch-prose values so nothing untranslated lingers; the demo
-- DB is re-seeded with keyed data.
UPDATE "Project" SET "nextStepKey" = 'sendQuote';
UPDATE "DeliveryChecklistItem" SET "labelKey" = 'workDone';
UPDATE "HandoverItem" SET "labelKey" = 'workDone';
