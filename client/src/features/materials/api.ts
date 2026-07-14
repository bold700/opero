import { api, type Page } from "../../lib/api/client";

// Keys mirror the backend Prisma enums (English internals; Dutch labels via
// i18n, see constants.ts).
export type MaterialClass = "insulation" | "fitting" | "tank" | "cladding";

export type MaterialComponent =
  | "meter"
  | "elbow"
  | "coupling"
  | "tee"
  | "threaded_fitting"
  | "flange"
  | "valve"
  | "pump"
  | "air_separator"
  | "reducer"
  | "alu_cap"
  | "buffer_vessel"
  | "area";

export type MaterialSizeUnit = "pipe_od_mm" | "pipe_dia_mm" | "tank_liters" | "flat";

// Mirrors the backend materialSummaryDto.
export type MaterialSummary = {
  id: string;
  key: string;
  name: string;
  class: MaterialClass;
  supplier: string;
  thicknessMm?: number;
  pipeMaterial?: "steel" | "copper" | "pvc";
  finish?: "none" | "white_pvc" | "reinforced_alu_foil";
  sizeUnit: MaterialSizeUnit;
  note?: string;
  variantCount: number;
  sizeRange?: { min: number; max: number };
};

// One class group of the catalog (backend GET /materials).
export type MaterialGroup = {
  class: MaterialClass;
  materials: MaterialSummary[];
};

// Mirrors the backend variantDto. `unitPrice` present only when the org shows
// prices to this role (stripped server-side for technicians).
export type MaterialVariant = {
  id: string;
  size: string;
  component: MaterialComponent;
  thicknessMm?: number;
  unit: "m" | "piece" | "m2";
  unitPrice?: number;
};

// Mirrors the backend materialDetailDto (attributes + provenance + variants).
export type MaterialDetail = Omit<MaterialSummary, "sizeRange"> & {
  priceSource?: string;
  priceValidFrom?: string;
  priceValidTo?: string;
  priceNote?: string;
  variants: MaterialVariant[];
};

// One flat search row = one variant with its material context. Mirrors the
// backend variantSearchRowDto.
export type MaterialVariantRow = {
  id: string; // = variantId
  materialId: string;
  name: string;
  materialName: string;
  class: MaterialClass;
  supplier: string;
  size: string;
  sizeUnit: MaterialSizeUnit;
  component: MaterialComponent;
  thicknessMm?: number;
  unit: string;
  unitPrice?: number;
};

// The catalog grouped by class (browse mode; 28 materials, no pagination).
export function getMaterialGroups(): Promise<MaterialGroup[]> {
  return api.get<MaterialGroup[]>("/materials");
}

// One material with its full variant set (detail page + picker cascade).
export function getMaterial(id: string): Promise<MaterialDetail> {
  return api.get<MaterialDetail>(`/materials/${id}`);
}

// Distinct supplier names for the filter chips.
export function getSuppliers(): Promise<string[]> {
  return api.get<string[]>("/materials/suppliers");
}

// One page of the flat variant search. `search` matches each word against
// material name, size, or component label; `supplier` filters to one supplier.
export function searchVariants(opts: {
  cursor?: string;
  search?: string;
  supplier?: string;
}): Promise<Page<MaterialVariantRow>> {
  return api.getPage<MaterialVariantRow>("/materials/variants", {
    cursor: opts.cursor,
    search: opts.search,
    params: opts.supplier ? { supplier: opts.supplier } : {},
  });
}
