import type { Material, MaterialClass, MaterialComponent, MaterialVariant } from "@prisma/client";

// Display-label maps for the materials catalog — ENGLISH KEYS, per-locale
// display strings resolved only at render time (same pattern as pdf.ts
// STATUS_NL). Never bake these strings into identifiers or logic.

export type DisplayLocale = "nl" | "en";

// Material class display names (the four kinds of catalog objects).
export const CLASS_LABELS: Record<MaterialClass, Record<DisplayLocale, string>> = {
  insulation: { nl: "Isolatie", en: "Insulation" },
  fitting: { nl: "Hulpstukken", en: "Fittings" },
  tank: { nl: "Buffervaten", en: "Buffer vessels" },
  cladding: { nl: "Plaatwerk", en: "Cladding" },
};

// Variant component display names. `meter`/`area` are priced-by-unit rows and
// don't appear in composed line names (the unit column carries that).
export const COMPONENT_LABELS: Record<MaterialComponent, Record<DisplayLocale, string>> = {
  meter: { nl: "Meter", en: "Per metre" },
  elbow: { nl: "Bocht", en: "Elbow" },
  coupling: { nl: "Koppeling", en: "Coupling" },
  tee: { nl: "T-stuk", en: "Tee" },
  threaded_fitting: { nl: "Draadappendage", en: "Threaded fitting" },
  flange: { nl: "Flens", en: "Flange" },
  valve: { nl: "Afsluiter", en: "Valve" },
  pump: { nl: "Pomp", en: "Pump" },
  air_separator: { nl: "Spirovent", en: "Air separator" },
  reducer: { nl: "Verloop", en: "Reducer" },
  alu_cap: { nl: "Alu-kap", en: "Aluminium cap" },
  buffer_vessel: { nl: "Buffervat", en: "Buffer vessel" },
  area: { nl: "Per m²", en: "Per m²" },
};

// Match a search word to component enum values whose NL or EN label contains it
// (case-insensitive) — so searching "bocht"/"elbow" finds the elbow variants
// even though the component is stored as the enum `elbow`.
export function componentsMatching(word: string): MaterialComponent[] {
  const w = word.toLowerCase();
  return (Object.keys(COMPONENT_LABELS) as MaterialComponent[]).filter((c) => {
    const { nl, en } = COMPONENT_LABELS[c];
    return nl.toLowerCase().includes(w) || en.toLowerCase().includes(w);
  });
}

// Variant unit → work-order line unit display word (lines store the unit as
// free text, e.g. "meter"/"stuk", matching the offerte's Eenheid column).
export const LINE_UNIT_LABELS: Record<string, Record<DisplayLocale, string>> = {
  m: { nl: "meter", en: "metre" },
  piece: { nl: "stuk", en: "piece" },
  m2: { nl: "m2", en: "m2" },
};

// Compose a work-order line description from a variant, mirroring the source
// offerte's lines ("Ø 22 Armaflex AF-2", "Ø 22 Armaflex AF-2 Draadappendage"):
// size prefix (Ø for pipe sizes, liters for tanks) + material name + component
// suffix for fittings + thickness suffix when the variant carries its own.
export function buildMaterialLineName(
  material: Pick<Material, "name" | "sizeUnit">,
  variant: Pick<MaterialVariant, "size" | "component" | "thicknessMm">,
  locale: DisplayLocale,
): string {
  const parts: string[] = [];
  if (material.sizeUnit === "pipe_od_mm" || material.sizeUnit === "pipe_dia_mm") {
    parts.push(`Ø ${variant.size}`);
  } else if (material.sizeUnit === "tank_liters") {
    parts.push(`${variant.size} L`);
  }
  parts.push(material.name);
  if (variant.component !== "meter" && variant.component !== "area") {
    parts.push(COMPONENT_LABELS[variant.component][locale]);
  }
  if (variant.thicknessMm != null) {
    parts.push(`${variant.thicknessMm} mm`);
  }
  return parts.join(" ");
}

// Parse a numeric diameter out of a pipe-size row key ("60" → 60; combined
// sizes like "21/22" and non-pipe sizes return null).
export function parseDiameter(
  material: Pick<Material, "sizeUnit">,
  variant: Pick<MaterialVariant, "size">,
): number | null {
  if (material.sizeUnit !== "pipe_od_mm" && material.sizeUnit !== "pipe_dia_mm") return null;
  const n = Number(variant.size);
  return Number.isFinite(n) ? n : null;
}
