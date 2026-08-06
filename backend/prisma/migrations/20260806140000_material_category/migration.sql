-- Material.category — which INSTALLATION SYSTEM a material belongs to.
--
-- This is a NEW axis, orthogonal to Material.class (which says what KIND of
-- object the material is: insulation / fitting / tank / cladding). Technicians
-- look material up by the system they are working on, so the catalog needs
-- the client's own trade groups: GKW, CV, KW/WW/CIRC, RIOOL/HWA.
--
-- Enum members are English-safe slugs of those Dutch trade abbreviations; the
-- literal display strings are supplied by i18n at render time.
--
-- Nullable with no default: existing materials are uncategorised until an
-- admin assigns a system, and a material that spans systems stays null.

CREATE TYPE "MaterialSystemCategory" AS ENUM ('gkw', 'cv', 'kw_ww_circ', 'riool_hwa');

ALTER TABLE "Material" ADD COLUMN "category" "MaterialSystemCategory";
