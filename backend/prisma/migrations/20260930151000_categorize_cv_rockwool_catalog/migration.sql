-- Older databases may already contain these price-list rows from the initial
-- seed, but without the CV system category that was introduced later. Assign
-- the category without touching variants or manually adjusted prices.
UPDATE "Material"
SET
  "category" = 'cv'::"MaterialSystemCategory",
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN (
  'cv_rockwool_isogenepak',
  'cv_rockwool_alu_foil'
)
AND "category" IS DISTINCT FROM 'cv'::"MaterialSystemCategory";
