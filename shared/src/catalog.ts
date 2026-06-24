export type CatalogCategory =
  | "insulation"
  | "material"
  | "labor"
  | "logistics";

export type CatalogItem = {
  id: string;
  category: CatalogCategory;
  name: string;
  unit: string;
  unitPrice: number;
  defaultQuantity: number;
};

export const catalogItems: CatalogItem[] = [
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-spouwmuur",
    name: "Spouwmuurisolatie",
    unit: "m2",
    unitPrice: 18,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-dak-binnen",
    name: "Dakisolatie binnenzijde",
    unit: "m2",
    unitPrice: 28,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-dak-buiten",
    name: "Dakisolatie buitenzijde",
    unit: "m2",
    unitPrice: 52,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-vloer",
    name: "Vloerisolatie",
    unit: "m2",
    unitPrice: 24,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-bodem",
    name: "Bodemisolatie",
    unit: "m2",
    unitPrice: 22,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-gevel",
    name: "Gevelisolatie buitenzijde",
    unit: "m2",
    unitPrice: 78,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-armaflex-af2",
    name: "Armaflex AF2",
    unit: "meter",
    unitPrice: 6,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-armaflex-13",
    name: "Armaflex 13mm",
    unit: "meter",
    unitPrice: 4,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-rockwool-25",
    name: "Rockwool 25",
    unit: "meter",
    unitPrice: 8,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-rockwool-28",
    name: "Rockwool 28",
    unit: "meter",
    unitPrice: 9,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-lameldeken",
    name: "Lameldeken",
    unit: "rol",
    unitPrice: 120,
  },
  {
    category: "insulation",
    defaultQuantity: 0,
    id: "iso-tracing",
    name: "Tracing",
    unit: "meter",
    unitPrice: 5,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-spuitlijm",
    name: "Spuitlijm",
    unit: "stuk",
    unitPrice: 18,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-pir-60",
    name: "PIR platen 60mm",
    unit: "m2",
    unitPrice: 15,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-pir-100",
    name: "PIR platen 100mm",
    unit: "m2",
    unitPrice: 22,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-eps",
    name: "EPS parels HR++",
    unit: "m3",
    unitPrice: 40,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-pur",
    name: "PUR schuim set",
    unit: "set",
    unitPrice: 85,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-folie",
    name: "Bodemfolie 300mu",
    unit: "rol",
    unitPrice: 65,
  },
  {
    category: "material",
    defaultQuantity: 0,
    id: "mat-rooster",
    name: "Ventilatierooster",
    unit: "stuk",
    unitPrice: 32,
  },
  {
    category: "labor",
    defaultQuantity: 0,
    id: "lab-uur",
    name: "Arbeid en uitvoering",
    unit: "uur",
    unitPrice: 65,
  },
  {
    category: "logistics",
    defaultQuantity: 1,
    id: "log-voorrijden",
    name: "Voorrijden en logistiek",
    unit: "post",
    unitPrice: 95,
  },
];

// Vaste eenheden voor werkbonregels (vervangt de losse "Soort"/"Meters/Bocht"
// kolommen van de papieren bon).
export const workOrderUnits = ["meter", "bocht", "rol", "stuk", "m2"];

export const catalogCategoryLabels: Record<CatalogCategory, string> = {
  labor: "Arbeid",
  insulation: "Isolatiewerk",
  logistics: "Logistiek",
  material: "Materiaal",
};

export function findCatalogItem(id?: string) {
  return id ? catalogItems.find((item) => item.id === id) : undefined;
}
