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
  | "area"
  | "set";

export type MaterialSizeUnit = "pipe_od_mm" | "pipe_dia_mm" | "tank_liters" | "flat";

// Which INSTALLATION SYSTEM a material is for — a different axis from `class`
// (what kind of object it is). This is how a technician looks material up in the
// field. Display strings are the client's trade codes (GKW, CV, KW/WW/CIRC,
// RIOOL/HWA), rendered from i18n; the keys stay English-safe slugs.
export type MaterialSystemCategory = "gkw" | "cv" | "kw_ww_circ" | "riool_hwa";

// Mirrors the backend materialSummaryDto.
export type MaterialSummary = {
  id: string;
  key: string;
  name: string;
  class: MaterialClass;
  // Absent when the material isn't tied to one installation system.
  category?: MaterialSystemCategory;
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

// Mirrors the backend variantDto. `unitPrice` is present only for roles that
// may see prices (canSeePrices — stripped server-side for field staff; there is
// no org toggle, it is absolute). `costPrice` (inkoopprijs) is admin-only —
// present only for admins (canSeeMargin).
export type MaterialVariant = {
  id: string;
  size: string;
  component: MaterialComponent;
  thicknessMm?: number;
  unit: "m" | "piece" | "m2";
  unitPrice?: number;
  costPrice?: number;
};

// Mirrors the backend materialDetailDto (attributes + variants). Provenance
// fields are admin-only optional metadata (present only for admins).
export type MaterialDetail = Omit<MaterialSummary, "sizeRange"> & {
  variants: MaterialVariant[];
  priceSource?: string;
  priceValidFrom?: string;
  priceValidTo?: string;
  priceNote?: string;
};

// One flat search row = one variant with its material context. Mirrors the
// backend variantSearchRowDto.
export type MaterialVariantRow = {
  id: string; // = variantId
  materialId: string;
  name: string;
  materialName: string;
  class: MaterialClass;
  category?: MaterialSystemCategory;
  supplier: string;
  size: string;
  sizeUnit: MaterialSizeUnit;
  component: MaterialComponent;
  thicknessMm?: number;
  unit: string;
  unitPrice?: number;
  costPrice?: number;
};

// The catalog grouped by class (browse mode; 28 materials, no pagination).
// `category` narrows to one installation system; omit it (or pass "") for all —
// materials without a category are only reachable through that "all" default.
export function getMaterialGroups(
  category?: MaterialSystemCategory | "",
): Promise<MaterialGroup[]> {
  return api.get<MaterialGroup[]>(
    category ? `/materials?category=${encodeURIComponent(category)}` : "/materials",
  );
}

// One material with its full variant set (detail page + picker cascade).
export function getMaterial(id: string): Promise<MaterialDetail> {
  return api.get<MaterialDetail>(`/materials/${id}`);
}

// --- Catalog CRUD (admin) -------------------------------------------------
// The catalog is user-managed: the seed only bootstraps it. `key`/`ordinal` are
// generated server-side, so create/edit payloads never include them.

export type MaterialInput = {
  name: string;
  class: MaterialClass;
  // null clears the system (the "no category" option in the form).
  category?: MaterialSystemCategory | null;
  supplier?: string;
  sizeUnit: MaterialSizeUnit;
  thicknessMm?: number | null;
  pipeMaterial?: string | null;
  finish?: string | null;
  note?: string | null;
  priceSource?: string | null;
  priceValidFrom?: string | null;
  priceValidTo?: string | null;
  priceNote?: string | null;
};

export type VariantInput = {
  size: string;
  component: MaterialComponent;
  thicknessMm?: number | null;
  unit: "m" | "piece" | "m2";
  unitPrice: number;
  costPrice?: number | null;
};

export function createMaterial(input: MaterialInput): Promise<MaterialDetail> {
  return api.post<MaterialDetail>("/materials", input);
}

export function updateMaterial(id: string, input: Partial<MaterialInput>): Promise<MaterialDetail> {
  return api.patch<MaterialDetail>(`/materials/${id}`, input);
}

// force=true deletes even when the material's variants are used on werkbon lines
// (those lines keep their snapshotted name/price; the variant link is nulled).
export function deleteMaterial(id: string, force = false): Promise<void> {
  return api.delete<void>(`/materials/${id}${force ? "?force=true" : ""}`);
}

export function createVariant(materialId: string, input: VariantInput): Promise<MaterialVariant> {
  return api.post<MaterialVariant>(`/materials/${materialId}/variants`, input);
}

export function updateVariant(variantId: string, input: Partial<VariantInput>): Promise<MaterialVariant> {
  return api.patch<MaterialVariant>(`/materials/variants/${variantId}`, input);
}

export function deleteVariant(variantId: string, force = false): Promise<void> {
  return api.delete<void>(`/materials/variants/${variantId}${force ? "?force=true" : ""}`);
}

// Cost-only edit (kept for the inline cost cell). Thin wrapper over updateVariant.
export function updateVariantCost(
  variantId: string,
  costPrice: number | null,
): Promise<MaterialVariant> {
  return api.patch<MaterialVariant>(`/materials/variants/${variantId}`, { costPrice });
}

// Enum option lists (class / category / component / sizeUnit / unit) with nl+en
// labels, server-driven so the forms match the backend's source of truth.
export type MetaOption = { value: string; nl: string; en: string };
export type MaterialMeta = {
  classes: MetaOption[];
  categories: MetaOption[];
  components: MetaOption[];
  units: MetaOption[];
  sizeUnits: MetaOption[];
};
export function getMaterialMeta(): Promise<MaterialMeta> {
  return api.get<MaterialMeta>("/materials/meta");
}

// Distinct supplier names for the filter chips.
export function getSuppliers(): Promise<string[]> {
  return api.get<string[]>("/materials/suppliers");
}

// One page of the flat variant search. `search` matches each word against
// material name, size, or component label; `supplier` filters to one supplier;
// `category` to one installation system.
export function searchVariants(opts: {
  cursor?: string;
  search?: string;
  supplier?: string;
  category?: MaterialSystemCategory | "";
}): Promise<Page<MaterialVariantRow>> {
  return api.getPage<MaterialVariantRow>("/materials/variants", {
    cursor: opts.cursor,
    search: opts.search,
    params: {
      ...(opts.supplier ? { supplier: opts.supplier } : {}),
      ...(opts.category ? { category: opts.category } : {}),
    },
  });
}

// --- Articles (other products & services: labour, logistics, misc) --------
// A flat org-scoped price list next to the material catalog. unitPrice is
// stripped server-side for field staff.

export type ArticleCategory = "insulation" | "material" | "labor" | "logistics";

export type Article = {
  id: string;
  category: ArticleCategory;
  name: string;
  unit: string;
  unitPrice?: number;
  defaultQuantity: number;
};

export type ArticleInput = {
  category: ArticleCategory;
  name: string;
  unit: string;
  unitPrice: number;
  defaultQuantity: number;
};

export function getArticles(): Promise<Article[]> {
  return api.get<Article[]>("/materials/articles");
}

export function createArticle(input: ArticleInput): Promise<Article> {
  return api.post<Article>("/materials/articles", input);
}

export function updateArticle(id: string, input: Partial<ArticleInput>): Promise<Article> {
  return api.patch<Article>(`/materials/articles/${id}`, input);
}

export function deleteArticle(id: string): Promise<void> {
  return api.delete<void>(`/materials/articles/${id}`);
}
