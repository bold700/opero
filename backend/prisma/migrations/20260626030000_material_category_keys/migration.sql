-- Material categories become English keys (i18n-translated in the UI), matching
-- the internals-English rule. Remap existing Dutch values + change the default.
ALTER TABLE "Material" ALTER COLUMN "category" SET DEFAULT 'other';

UPDATE "Material" SET "category" = CASE "category"
  WHEN 'Isolatie'       THEN 'insulation'
  WHEN 'Bevestiging'    THEN 'fastening'
  WHEN 'Folie'          THEN 'foil'
  WHEN 'Afdichting'     THEN 'sealing'
  WHEN 'Gereedschap'    THEN 'tools'
  WHEN 'Bodemisolatie'  THEN 'floor_insulation'
  WHEN 'Overig'         THEN 'other'
  ELSE 'other'
END;
