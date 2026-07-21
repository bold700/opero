-- Technicians never see prices: the rule is absolute, so the per-org override
-- is gone (see canSeePrices in @opero/shared). Drops the settings toggle.
ALTER TABLE "Organization" DROP COLUMN "hidePricesFromTechnicians";
