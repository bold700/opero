-- Backfill installation-system categories on the seeded catalog materials
-- (UX review: workers filter by GKW / CV / KW-WW-CIRC / RIOOL-HWA, and the
-- GKW filter matched nothing). Seeding only runs on a fresh database, so
-- existing rows need this one-time remap. Scoped to the known seed keys and
-- to rows still NULL, so an admin's own categorisation is never overwritten.
--
-- Mapping: the AF/Armaflex elastomeric range (incl. its buffer vessels, its
-- Victaulic fittings and its dedicated cladding) is the chilled-water (GKW)
-- programme; Kooltherm FM phenolic shells are heating (CV). Generic cladding
-- is applied over any system and deliberately stays uncategorised.

UPDATE "Material"
SET "category" = 'gkw'
WHERE "category" IS NULL
  AND "key" IN (
    'armaflex_ultima_19',
    'victaulic_fittings',
    'af_armaflex_af2_13',
    'af2_buffer_vessels',
    'af_armaflex_af4_19',
    'af4_buffer_vessels',
    'cladding_af_armaflex',
    'af_armaflex_af5_25',
    'af5_buffer_vessels',
    'af_armaflex_af6',
    'af6_buffer_vessels'
  );

UPDATE "Material"
SET "category" = 'cv'
WHERE "category" IS NULL
  AND "key" = 'kooltherm_fm';
