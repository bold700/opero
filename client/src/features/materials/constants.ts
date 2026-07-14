import type { MaterialClass, MaterialComponent, MaterialSizeUnit } from "./api";

// Class display order — how the four kinds of catalog objects are grouped.
export const CLASS_ORDER: MaterialClass[] = [
  "insulation",
  "fitting",
  "tank",
  "cladding",
];

export const CLASS_LABEL_KEYS: Record<MaterialClass, string> = {
  insulation: "materials.class.insulation",
  fitting: "materials.class.fitting",
  tank: "materials.class.tank",
  cladding: "materials.class.cladding",
};

// Variant/component order for pickers and detail tables — mirrors the source
// documents' layout (meter first, then fittings left-to-right as printed).
export const COMPONENT_ORDER: MaterialComponent[] = [
  "meter",
  "elbow",
  "coupling",
  "tee",
  "threaded_fitting",
  "flange",
  "valve",
  "pump",
  "air_separator",
  "reducer",
  "alu_cap",
  "buffer_vessel",
  "area",
];

export const COMPONENT_LABEL_KEYS: Record<MaterialComponent, string> = {
  meter: "materials.component.meter",
  elbow: "materials.component.elbow",
  coupling: "materials.component.coupling",
  tee: "materials.component.tee",
  threaded_fitting: "materials.component.threaded_fitting",
  flange: "materials.component.flange",
  valve: "materials.component.valve",
  pump: "materials.component.pump",
  air_separator: "materials.component.air_separator",
  reducer: "materials.component.reducer",
  alu_cap: "materials.component.alu_cap",
  buffer_vessel: "materials.component.buffer_vessel",
  area: "materials.component.area",
};

// Header label of the size column, by what `size` means for the material.
export const SIZE_UNIT_LABEL_KEYS: Record<MaterialSizeUnit, string> = {
  pipe_od_mm: "materials.sizeUnit.pipe_od_mm",
  pipe_dia_mm: "materials.sizeUnit.pipe_dia_mm",
  tank_liters: "materials.sizeUnit.tank_liters",
  flat: "materials.sizeUnit.flat",
};

// Material meta badge labels.
export const FINISH_LABEL_KEYS: Record<string, string> = {
  none: "materials.finish.none",
  white_pvc: "materials.finish.white_pvc",
  reinforced_alu_foil: "materials.finish.reinforced_alu_foil",
};

export const PIPE_MATERIAL_LABEL_KEYS: Record<string, string> = {
  steel: "materials.pipeMaterial.steel",
  copper: "materials.pipeMaterial.copper",
  pvc: "materials.pipeMaterial.pvc",
};

// € formatting — nl-NL, 2 decimals (same style as the work-order lines).
export function formatPrice(value: number): string {
  return `€ ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// "Ø 17–324" / "150–2500 L" — compact display of a material's size range.
export function formatSizeRange(
  sizeUnit: MaterialSizeUnit,
  range?: { min: number; max: number },
): string {
  if (!range) return "—";
  const span = range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`;
  if (sizeUnit === "tank_liters") return `${span} L`;
  if (sizeUnit === "flat") return "—";
  return `Ø ${span}`;
}
